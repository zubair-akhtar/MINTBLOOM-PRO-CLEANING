// @polsia:framework-owned
import { createHash, randomUUID } from 'node:crypto';
import type { z } from 'zod';
import {
  type Answers,
  type FormDefinition,
  type IntakeStatus,
  type ListQuery,
  listQuerySchema,
  listResponseSchema,
  type Mutation,
  mutationSchema,
  type RequestDetail,
  requestDetailSchema,
  requestSummarySchema,
  transitions,
} from './contracts';
import type { Database, SqlExecutor } from './database';

export class StoreError extends Error {
  constructor(
    public status: number,
    message: string,
  ) {
    super(message);
    this.name = 'StoreError';
  }
}

type Row = Record<string, unknown>;
const columns = `r.id, r.reference, r.scope, r.snapshot, r.answers, r.contact,
  r.status, r.note, r.version, r.created_at,
  n.status AS notification_status, n.attempts, n.last_error, n.lease_until`;
const joined =
  'service_intake_requests r JOIN service_intake_notifications n ON n.request_id = r.id';
const iso = (value: unknown) => (value instanceof Date ? value.toISOString() : String(value));
function summary(row: Row) {
  const snapshot = row.snapshot as FormDefinition;
  return requestSummarySchema.parse({
    id: row.id,
    reference: row.reference,
    formTitle: snapshot.title,
    contact: row.contact,
    status: row.status,
    version: row.version,
    createdAt: iso(row.created_at),
    notification: {
      status: row.notification_status,
      attempts: row.attempts,
      lastError: row.last_error,
      leaseUntil: row.lease_until ? iso(row.lease_until) : null,
    },
  });
}
async function detail(tx: SqlExecutor, scopes: string[], id: string): Promise<RequestDetail> {
  const [row] = await tx.query(
    `SELECT ${columns} FROM ${joined} WHERE r.id = $1 AND r.scope = ANY($2::text[])`,
    [id, scopes],
  );
  if (!row) throw new StoreError(404, 'Request not found');
  const history = await tx.query(
    `SELECT from_status, to_status, actor_id, created_at FROM service_intake_history
    WHERE request_id = $1 ORDER BY created_at, id`,
    [id],
  );
  return requestDetailSchema.parse({
    ...summary(row),
    scope: row.scope,
    snapshot: row.snapshot,
    answers: row.answers,
    note: row.note,
    history: history.map((event) => ({
      from: event.from_status,
      to: event.to_status,
      actorId: event.actor_id,
      createdAt: iso(event.created_at),
    })),
  });
}
async function consumeRate(tx: SqlExecutor, key: string, limit: number, windowSeconds: number) {
  const rows = await tx.query(
    `INSERT INTO service_intake_rate_buckets (key, count, window_start)
    VALUES ($1, 1, CURRENT_TIMESTAMP)
    ON CONFLICT (key) DO UPDATE SET
      count = CASE WHEN service_intake_rate_buckets.window_start <= CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second') THEN 1 ELSE service_intake_rate_buckets.count + 1 END,
      window_start = CASE WHEN service_intake_rate_buckets.window_start <= CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second') THEN CURRENT_TIMESTAMP ELSE service_intake_rate_buckets.window_start END
    WHERE service_intake_rate_buckets.window_start <= CURRENT_TIMESTAMP - ($3 * INTERVAL '1 second') OR service_intake_rate_buckets.count < $2
    RETURNING count`,
    [key, limit, windowSeconds],
  );
  if (!rows.length) throw new StoreError(429, 'Too many requests. Please try again later.');
}

export class IntakeStore {
  constructor(private readonly db: Database) {}

  async findAttempt(
    scope: string,
    attemptId: string,
  ): Promise<{ digest: string; reference: string } | null> {
    const [row] = await this.db.query<{ digest: string; reference: string }>(
      'SELECT digest, reference FROM service_intake_requests WHERE scope = $1 AND attempt_id = $2',
      [scope, attemptId],
    );
    return row ?? null;
  }

  async create(input: {
    scope: string;
    attemptId: string;
    digest: string;
    snapshot: FormDefinition;
    answers: Answers;
    contact: string;
  }): Promise<{ reference: string; id: string; replayed: boolean }> {
    return this.db.transaction(async (tx) => {
      const id = randomUUID();
      const reference = `SR-${randomUUID()}`;
      // A conflicting insert waits for the first transaction, then reads its committed result.
      const inserted = await tx.query(
        `INSERT INTO service_intake_requests
        (id, reference, scope, attempt_id, digest, snapshot, answers, contact)
        VALUES ($1, $2, $3, $4, $5, $6::jsonb, $7::jsonb, $8)
        ON CONFLICT (scope, attempt_id) DO NOTHING RETURNING id`,
        [
          id,
          reference,
          input.scope,
          input.attemptId,
          input.digest,
          JSON.stringify(input.snapshot),
          JSON.stringify(input.answers),
          input.contact,
        ],
      );
      if (!inserted.length) {
        const [previous] = await tx.query<{ id: string; reference: string; digest: string }>(
          'SELECT id, reference, digest FROM service_intake_requests WHERE scope = $1 AND attempt_id = $2',
          [input.scope, input.attemptId],
        );
        if (!previous || previous.digest !== input.digest)
          throw new StoreError(409, 'This attempt was already used for different answers');
        return { id: previous.id, reference: previous.reference, replayed: true };
      }
      const contactHash = createHash('sha256')
        .update(input.contact.trim().toLowerCase())
        .digest('hex');
      await consumeRate(tx, `contact:${input.scope}:${contactHash}`, 5, 15 * 60);
      await tx.query(
        `INSERT INTO service_intake_history (id, request_id, from_status, to_status) VALUES ($1, $2, NULL, 'received') RETURNING id`,
        [randomUUID(), id],
      );
      await tx.query(
        'INSERT INTO service_intake_notifications (request_id) VALUES ($1) RETURNING request_id',
        [id],
      );
      return { reference, id, replayed: false };
    });
  }

  async consumeRate(key: string, limit: number, windowSeconds: number): Promise<void> {
    if (
      !Number.isInteger(limit) ||
      limit < 1 ||
      !Number.isInteger(windowSeconds) ||
      windowSeconds < 1
    )
      throw new Error('Invalid rate limit');
    await consumeRate(this.db, key, limit, windowSeconds);
  }

  async list(scopes: string[], query: ListQuery): Promise<z.infer<typeof listResponseSchema>> {
    const { q, status, page, pageSize } = listQuerySchema.parse(query);
    // Escape LIKE wildcards: user search is literal text, including % and _.
    const search = `%${q.replace(/[\\%_]/g, '\\$&')}%`;
    const where = `r.scope = ANY($1::text[]) AND ($2::text IS NULL OR r.status = $2)
      AND (r.reference ILIKE $3 OR r.contact ILIKE $3)`;
    const params = [scopes, status ?? null, search];
    const [count] = await this.db.query<{ total: number }>(
      `SELECT count(*)::int AS total FROM service_intake_requests r WHERE ${where}`,
      params,
    );
    if (!count) throw new Error('Request count was not returned by the database');
    const rows = await this.db.query(
      `SELECT ${columns} FROM ${joined} WHERE ${where}
      ORDER BY r.created_at DESC, r.id LIMIT $4 OFFSET $5`,
      [...params, pageSize, (page - 1) * pageSize],
    );
    return listResponseSchema.parse({
      items: rows.map(summary),
      total: count.total,
      page,
      pageSize,
    });
  }

  async detail(scopes: string[], id: string): Promise<RequestDetail> {
    return this.db.transaction((tx) => detail(tx, scopes, id));
  }

  async update(
    scopes: string[],
    id: string,
    mutation: Mutation,
    actorId: string,
  ): Promise<RequestDetail> {
    const input = mutationSchema.parse(mutation);
    return this.db.transaction(async (tx) => {
      const [current] = await tx.query<{ status: IntakeStatus; version: number }>(
        'SELECT status, version FROM service_intake_requests WHERE id = $1 AND scope = ANY($2::text[]) FOR UPDATE',
        [id, scopes],
      );
      if (!current) throw new StoreError(404, 'Request not found');
      if (current.version !== input.expectedVersion)
        throw new StoreError(409, 'This request changed. Reload before saving.');
      if (input.status && !transitions[current.status].includes(input.status))
        throw new StoreError(409, 'This status transition is not allowed');
      await tx.query(
        `UPDATE service_intake_requests SET status = COALESCE($3, status), note = COALESCE($4, note), version = version + 1
        WHERE id = $1 AND scope = ANY($2::text[]) RETURNING id`,
        [id, scopes, input.status ?? null, input.note ?? null],
      );
      if (input.status)
        await tx.query(
          `INSERT INTO service_intake_history (id, request_id, from_status, to_status, actor_id)
        VALUES ($1, $2, $3, $4, $5) RETURNING id`,
          [randomUUID(), id, current.status, input.status, actorId],
        );
      return detail(tx, scopes, id);
    });
  }

  async claimNotification(
    scopes: string[],
    id: string,
  ): Promise<{ token: string; item: RequestDetail } | null> {
    return this.db.transaction(async (tx) => {
      const [request] = await tx.query(
        'SELECT id FROM service_intake_requests WHERE id = $1 AND scope = ANY($2::text[])',
        [id, scopes],
      );
      if (!request) throw new StoreError(404, 'Request not found');
      const token = randomUUID();
      const rows = await tx.query(
        `UPDATE service_intake_notifications n SET status = 'sending', token = $3,
        lease_until = CURRENT_TIMESTAMP + INTERVAL '2 minutes', attempts = attempts + 1, last_error = NULL
        WHERE request_id = $1 AND EXISTS (SELECT 1 FROM service_intake_requests r WHERE r.id = n.request_id AND r.scope = ANY($2::text[]))
        AND (n.status IN ('pending', 'failed') OR (n.status = 'sending' AND n.lease_until <= CURRENT_TIMESTAMP))
        RETURNING request_id`,
        [id, scopes, token],
      );
      if (!rows.length) return null;
      return { token, item: await detail(tx, scopes, id) };
    });
  }

  async finishNotification(id: string, token: string, error: string | null): Promise<void> {
    await this.db.query(
      `UPDATE service_intake_notifications SET status = $3, last_error = $4, token = NULL, lease_until = NULL
      WHERE request_id = $1 AND token = $2 AND status = 'sending' RETURNING request_id`,
      [id, token, error === null ? 'sent' : 'failed', error === null ? null : error.slice(0, 500)],
    );
  }
}
