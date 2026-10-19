// @polsia:framework-owned
import { createHash } from 'node:crypto';
import { z } from 'zod';
import {
  type Answers,
  detailResponseSchema,
  type FormDefinition,
  listQuerySchema,
  listResponseSchema,
  mutationSchema,
  type RequestDetail,
  submissionResponseSchema,
  submissionSchema,
  validateAnswers,
} from './contracts';
import { type IntakeStore, StoreError } from './store';

export interface IntakeAdmin {
  id: string;
  role?: string | null;
}
export interface IntakeAdapters {
  // Canonical browser URL from trusted server configuration, including protocol and port.
  publicOrigin?: string;
  // Exact additional browser origins from server-held domain configuration; no wildcards.
  trustedOrigins?: string[];
  getForm(id: string): FormDefinition | undefined;
  scopeForForm(id: string): string;
  contactField(id: string): string;
  validateBusiness(form: FormDefinition, answers: Answers): Promise<Record<string, string>>;
  session(request: Request): Promise<IntakeAdmin | null>;
  adminScopes(user: IntakeAdmin): Promise<string[]>;
  // Honor cancellation in external transports; attempts expire before the delivery lease.
  notify(item: RequestDetail, signal?: AbortSignal): Promise<string>;
  schedule(work: () => Promise<void>): void;
}

function canonical(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonical).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.entries(value)
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([key, entry]) => `${JSON.stringify(key)}:${canonical(entry)}`)
      .join(',')}}`;
  return JSON.stringify(value);
}
export function submissionDigest(value: unknown): string {
  return createHash('sha256').update(canonical(value)).digest('hex');
}
function sameOrigin(request: Request, publicOrigin?: string, trustedOrigins: string[] = []) {
  const origin = request.headers.get('origin');
  const target = new URL(publicOrigin ?? request.url);
  if (!['http:', 'https:'].includes(target.protocol))
    throw new Error('Configure an HTTP or HTTPS public origin.');
  // Retain compatibility with existing adapters. New installations use the
  // configured origin so TLS termination and internal proxy hosts cannot alter it.
  if (!publicOrigin) {
    const host = request.headers.get('host');
    if (host) target.host = host;
  }
  const allowed = new Set([target.origin]);
  for (const configured of trustedOrigins) {
    const extra = new URL(configured);
    if (
      !['http:', 'https:'].includes(extra.protocol) ||
      configured.includes('*') ||
      extra.username ||
      extra.password ||
      extra.pathname !== '/' ||
      extra.search ||
      extra.hash
    )
      throw new Error('Configure exact HTTP or HTTPS trusted origins without wildcards.');
    allowed.add(extra.origin);
  }
  // One Polsia app has two platform domains. Preserve its slug, environment,
  // protocol, and port; other tenants and environments are never trusted.
  const platform =
    publicOrigin && /^([a-z0-9-]+)\.(staging\.)?polsia\.(app|io)$/.exec(target.hostname);
  if (platform) {
    const backup = new URL(target);
    backup.hostname = `${platform[1]}.${platform[2] ?? ''}polsia.${platform[3] === 'app' ? 'io' : 'app'}`;
    allowed.add(backup.origin);
  }
  const loopback = ['localhost', '127.0.0.1', '[::1]'];
  if (publicOrigin && loopback.includes(target.hostname))
    for (const hostname of loopback) {
      const alias = new URL(target);
      alias.hostname = hostname;
      allowed.add(alias.origin);
    }
  if ((origin && !allowed.has(origin)) || request.headers.get('sec-fetch-site') === 'cross-site')
    throw new StoreError(403, 'This request must come from this site.');
}
async function readBody(request: Request): Promise<unknown> {
  if (!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))
    throw new StoreError(415, 'Send JSON data.');
  if (Number(request.headers.get('content-length')) > 32768)
    throw new StoreError(413, 'Request is too large.');
  const reader = request.body?.getReader();
  if (!reader) throw new StoreError(400, 'Request body is required.');
  const chunks: Uint8Array[] = [];
  let size = 0;
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      size += value.byteLength;
      if (size > 32768) {
        await reader.cancel();
        throw new StoreError(413, 'Request is too large.');
      }
      chunks.push(value);
    }
  } finally {
    reader.releaseLock();
  }
  const bytes = new Uint8Array(size);
  let offset = 0;
  for (const chunk of chunks) {
    bytes.set(chunk, offset);
    offset += chunk.length;
  }
  try {
    return JSON.parse(new TextDecoder('utf-8', { fatal: true }).decode(bytes));
  } catch {
    throw new StoreError(400, 'Request body must be valid JSON.');
  }
}
function json(value: unknown, status = 200) {
  return Response.json(value, { status, headers: { 'cache-control': 'no-store' } });
}
function failure(error: unknown): Response {
  if (error instanceof z.ZodError) {
    const errors: Record<string, string> = {};
    for (const issue of error.issues) {
      const path = issue.path.join('.') || 'root';
      errors[path] ??= issue.message;
    }
    return json({ errors }, 400);
  }
  if (error instanceof StoreError)
    return Response.json(
      { error: error.message, errors: { root: error.message } },
      {
        status: error.status,
        headers: {
          'cache-control': 'no-store',
          ...(error.status === 429 ? { 'retry-after': '60' } : {}),
        },
      },
    );
  return json(
    {
      error: 'Could not complete the request. Please retry.',
      errors: { root: 'Could not complete the request. Please retry.' },
    },
    500,
  );
}
export function createHandlers(store: IntakeStore, adapters: IntakeAdapters) {
  async function admin(request: Request) {
    const user = await adapters.session(request);
    if (!user) throw new StoreError(401, 'Sign in to continue.');
    if (
      !user.role
        ?.split(',')
        .map((role) => role.trim())
        .includes('admin')
    )
      throw new StoreError(403, 'Administrator access is required.');
    const scopes = await adapters.adminScopes(user);
    if (
      !scopes.length ||
      scopes.some((scope) => !scope || scope.length > 100) ||
      scopes.length > 100
    )
      throw new StoreError(403, 'No authorized request scope.');
    return { user, scopes };
  }
  async function deliver(scopes: string[], id: string) {
    const claim = await store.claimNotification(scopes, id);
    if (!claim) return;
    let error: string | null = null;
    const signal = AbortSignal.timeout(30_000);
    let onTimeout = () => {};
    const timeout = new Promise<never>((_resolve, reject) => {
      onTimeout = () => reject(signal.reason);
      signal.addEventListener('abort', onTimeout, { once: true });
    });
    try {
      const receipt = await Promise.race([adapters.notify(claim.item, signal), timeout]);
      if (!receipt)
        error = 'The email provider did not confirm sending. Check the recipient and retry.';
    } catch {
      error =
        'Notification could not be confirmed. Check email configuration and retry; a previous attempt may have been sent.';
    } finally {
      signal.removeEventListener('abort', onTimeout);
    }
    await store.finishNotification(id, claim.token, error);
  }
  return {
    async submit(request: Request): Promise<Response> {
      try {
        sameOrigin(request, adapters.publicOrigin, adapters.trustedOrigins);
        // Site-wide budget bounds malformed requests too, without trusting a spoofable proxy IP.
        await store.consumeRate('public:service-intake', 60, 60);
        const input = submissionSchema.parse(await readBody(request));
        const scope = adapters.scopeForForm(input.formId);
        if (!scope || scope.length > 100) throw new StoreError(400, 'Unknown request type.');
        const digest = submissionDigest(input);
        const previous = await store.findAttempt(scope, input.attemptId);
        if (previous) {
          if (previous.digest !== digest)
            throw new StoreError(
              409,
              'This attempt already saved different answers. Start a new request.',
            );
          return json(submissionResponseSchema.parse({ reference: previous.reference }));
        }
        const form = adapters.getForm(input.formId);
        if (!form) throw new StoreError(400, 'Unknown request type.');
        if (form.version !== input.formVersion)
          throw new StoreError(409, 'The form has changed. Reload before starting a new request.');
        const answers = validateAnswers(form, input.answers);
        const errors = await adapters.validateBusiness(form, answers);
        if (Object.keys(errors).length) return json({ errors }, 400);
        const contact = answers[adapters.contactField(input.formId)];
        if (typeof contact !== 'string' || !contact.trim())
          throw new StoreError(400, 'Contact information is required.');
        const saved = await store.create({
          scope,
          attemptId: input.attemptId,
          digest,
          snapshot: form,
          answers,
          contact,
        });
        // A failed scheduler leaves a durable pending intent for the administrator to retry.
        try {
          adapters.schedule(async () => {
            try {
              await deliver([scope], saved.id);
            } catch {
              /* The persisted intent remains recoverable. */
            }
          });
        } catch {
          /* Capture already committed. */
        }
        return json(
          submissionResponseSchema.parse({ reference: saved.reference }),
          saved.replayed ? 200 : 201,
        );
      } catch (error) {
        return failure(error);
      }
    },
    async list(request: Request): Promise<Response> {
      try {
        const { scopes } = await admin(request);
        const query = listQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
        return json(listResponseSchema.parse(await store.list(scopes, query)));
      } catch (error) {
        return failure(error);
      }
    },
    async detail(request: Request, id: string): Promise<Response> {
      try {
        const { scopes } = await admin(request);
        return json(
          detailResponseSchema.parse({
            item: await store.detail(scopes, z.string().uuid().parse(id)),
          }),
        );
      } catch (error) {
        return failure(error);
      }
    },
    async update(request: Request, id: string): Promise<Response> {
      try {
        sameOrigin(request, adapters.publicOrigin, adapters.trustedOrigins);
        const { user, scopes } = await admin(request);
        const mutation = mutationSchema.parse(await readBody(request));
        return json(
          detailResponseSchema.parse({
            item: await store.update(scopes, z.string().uuid().parse(id), mutation, user.id),
          }),
        );
      } catch (error) {
        return failure(error);
      }
    },
    async retry(request: Request, id: string): Promise<Response> {
      try {
        sameOrigin(request, adapters.publicOrigin, adapters.trustedOrigins);
        const { scopes } = await admin(request);
        z.string().uuid().parse(id);
        // Authorize before creating or consuming this request's retry bucket.
        await store.detail(scopes, id);
        await store.consumeRate(`retry:${id}`, 5, 60);
        await deliver(scopes, id);
        return json(detailResponseSchema.parse({ item: await store.detail(scopes, id) }));
      } catch (error) {
        return failure(error);
      }
    },
  };
}
