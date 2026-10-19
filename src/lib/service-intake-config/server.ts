// @polsia:user-owned
import 'server-only';
import { after } from 'next/server';
import { auth } from '@/lib/auth';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';
import type { Database, SqlExecutor } from '@/modules/service-intake/database';
import { createHandlers, type IntakeAdapters } from '@/modules/service-intake/handlers';
import { IntakeStore } from '@/modules/service-intake/store';
import { intakeForms } from './forms';

const database: Database = {
  query: (sql, params = []) => prisma.$queryRawUnsafe(sql, ...params),
  transaction: (work) =>
    prisma.$transaction((tx) => {
      const executor: SqlExecutor = {
        query: (sql, params = []) => tx.$queryRawUnsafe(sql, ...params),
      };
      return work(executor);
    }),
};

// This seed serves one business. For multi-tenant apps, derive scopes exclusively
// from server-held membership records; never accept them from request input.
export const intakeAdapters: IntakeAdapters = {
  publicOrigin: env.BETTER_AUTH_URL,
  trustedOrigins: env.BETTER_AUTH_TRUSTED_ORIGINS?.split(',')
    .map((origin) => origin.trim())
    // Auth's shared platform wildcards are not tenant authorization. The module
    // derives this app's platform origins from publicOrigin and accepts exact
    // custom origins here. Replace this list to narrow it further for your app.
    // Unknown wildcards remain configuration errors at the module boundary.
    .filter((origin) => {
      if (!origin || /^https:\/\/\*\.(?:staging\.)?polsia\.(?:app|io)$/.test(origin)) return false;
      try {
        const parsed = new URL(origin);
        return (
          ['http:', 'https:'].includes(parsed.protocol) &&
          !origin.includes('*') &&
          !parsed.username &&
          !parsed.password &&
          parsed.pathname === '/' &&
          !parsed.search &&
          !parsed.hash
        );
      } catch {
        return false;
      }
    }),
  getForm: (id) => intakeForms.find((form) => form.id === id),
  scopeForForm: () => 'default',
  contactField: () => 'email',
  adminScopes: async () => ['default'],
  session: async (request) => {
    const user = (await auth.api.getSession({ headers: request.headers }))?.user;
    // Authentication owns role assignment. The handlers enforce admin access
    // and authorized scopes without adding a separate email-verification policy.
    return user ?? null;
  },
  validateBusiness: async (_form, answers) => {
    const errors: Record<string, string> = {};
    if (
      typeof answers.preferred_date === 'string' &&
      answers.preferred_date &&
      answers.preferred_date < new Date().toISOString().slice(0, 10)
    )
      errors.preferred_date = 'Choose today or a future date.';
    return errors;
  },
  notify: async (item, signal) => {
    if (!env.POLSIA_OWNER_EMAIL) throw new Error('Configure the notification recipient.');
    // Keep visitor content plain text, with HTML escaping at this one boundary.
    const lines = [`Request ${item.reference}`, item.snapshot.title, `Contact: ${item.contact}`];
    for (const step of item.snapshot.steps)
      for (const field of step.fields) {
        const value = item.answers[field.id];
        const values = Array.isArray(value) ? value : [value];
        lines.push(
          `${field.label}: ${values.map((entry) => field.options?.find((option) => option.value === entry)?.label ?? entry ?? '—').join(', ')}`,
        );
      }
    const text = lines.join('\n');
    const html = `<pre>${text.replace(/[&<>"']/g, (char) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[char] ?? char)}</pre>`;
    const result = await sendEmail(
      {
        to: env.POLSIA_OWNER_EMAIL,
        subject: `New service request ${item.reference}`,
        text,
        html,
      },
      { signal },
    );
    return result.id;
  },
  schedule: (work) => after(work),
};
export const intakeHandlers = createHandlers(new IntakeStore(database), intakeAdapters);
