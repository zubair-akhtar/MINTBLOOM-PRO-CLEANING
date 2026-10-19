// @polsia:user-owned — Customize this screen for your business.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import Link from 'next/link';
import { useCallback, useEffect, useState } from 'react';
import { useForm } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import { applyServerErrors } from '@/lib/forms';
import {
  detailResponseSchema,
  type Mutation,
  mutationSchema,
  type RequestDetail as RequestData,
  statusLabels,
  transitions,
} from '@/modules/service-intake/contracts';

export function RequestDetail({ id }: { id: string }) {
  const { isPending, data: session } = useSession();
  const isAdmin = useIsAdmin();
  const [item, setItem] = useState<RequestData | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');
  const [conflict, setConflict] = useState(false);
  const [saved, setSaved] = useState('');
  const [now, setNow] = useState(Date.now());
  const [refresh, setRefresh] = useState(0);
  const form = useForm<Mutation>({ resolver: zodResolver(mutationSchema) });
  const { reset } = form;
  const path = `/api/admin/service-intake/${encodeURIComponent(id)}`;
  const accept = useCallback(
    (result: RequestData) => {
      setItem(result);
      reset({ expectedVersion: result.version, status: result.status, note: result.note });
      setConflict(false);
    },
    [reset],
  );
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh counter explicitly reloads the current resource.
  useEffect(() => {
    if (!isAdmin || isPending) {
      setItem(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setItem(null);
    void apiFetch(path, { schema: detailResponseSchema, signal: controller.signal })
      .then((result) => {
        if (active) accept(result.item);
      })
      .catch(() => {
        if (active)
          setError(
            'This request could not be loaded. It may be unavailable or outside your access.',
          );
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [path, isAdmin, isPending, accept, refresh]);
  useEffect(() => {
    const timer = setInterval(() => setNow(Date.now()), 10000);
    return () => clearInterval(timer);
  }, []);

  async function save(values: Mutation) {
    if (busy || conflict) return;
    setBusy(true);
    setError('');
    setSaved('');
    try {
      const result = await apiFetch(path, {
        method: 'PATCH',
        body: JSON.stringify(
          mutationSchema.parse({
            ...values,
            status: values.status === item?.status ? undefined : values.status,
          }),
        ),
        schema: detailResponseSchema,
      });
      accept(result.item);
      setSaved('Changes saved.');
    } catch (failure) {
      if (failure instanceof Error && failure.message.endsWith('(409)')) {
        setConflict(true);
        setError(
          'Another administrator changed this request. Your draft is still here. Copy any text you want to keep, then reload the latest request before editing again.',
        );
      } else {
        if (failure instanceof Error) applyServerErrors(failure.cause, form.setError);
        setError(
          'Changes could not be confirmed. Your draft has been kept. Try saving again; a version conflict will require reloading.',
        );
      }
    } finally {
      setBusy(false);
    }
  }

  async function retry() {
    if (busy) return;
    setBusy(true);
    setSaved('');
    try {
      const result = await apiFetch(`${path}/retry`, {
        method: 'POST',
        schema: detailResponseSchema,
      });
      // A delivery retry must not overwrite a private note being edited.
      setItem((previous) =>
        previous ? { ...previous, notification: result.item.notification } : previous,
      );
      setNow(Date.now());
      setSaved(
        result.item.notification.status === 'sent'
          ? 'Notification sent.'
          : 'Notification status updated. Check the delivery details below.',
      );
    } catch {
      setError(
        'The notification retry could not be confirmed. Reload the request to check its delivery status before retrying.',
      );
    } finally {
      setBusy(false);
    }
  }
  if (isPending) return <output>Checking access…</output>;
  if (!isAdmin || !session)
    return <p role="alert">Administrator access is required to view this request.</p>;
  if (loading) return <output>Loading request…</output>;
  if (!item)
    return (
      <div role="alert" className="space-y-3">
        <p>{error}</p>
        <Button type="button" variant="outline" onClick={() => setRefresh((value) => value + 1)}>
          Try again
        </Button>
      </div>
    );
  const expired =
    item.notification.status === 'sending' &&
    (!item.notification.leaseUntil || Date.parse(item.notification.leaseUntil) <= now);
  const retryable =
    item.notification.status === 'pending' || item.notification.status === 'failed' || expired;
  return (
    <article className="space-y-8">
      <header className="space-y-2">
        <Link href="/admin/service-requests" className="text-sm underline underline-offset-4">
          All service requests
        </Link>
        <h1 className="break-all text-3xl font-semibold tracking-tight">{item.reference}</h1>
        <p className="text-muted-foreground">{item.formTitle}</p>
        <p className="text-sm">
          {statusLabels[item.status]} · Received{' '}
          <time dateTime={item.createdAt}>{new Date(item.createdAt).toLocaleString()}</time>
        </p>
      </header>
      {error && (
        <p
          role="alert"
          className="rounded-md border border-destructive p-4 text-sm text-destructive"
        >
          {error}
        </p>
      )}
      {saved && <output className="text-sm">{saved}</output>}
      <div className="grid gap-10 lg:grid-cols-2">
        <section className="space-y-6" aria-label="Submitted answers">
          {item.snapshot.steps.map((step) => (
            <section key={step.id} className="space-y-3">
              <h2 className="text-lg font-semibold">{step.title}</h2>
              <dl className="space-y-4">
                {step.fields.map((field) => {
                  const value = item.answers[field.id];
                  const label = (answer: string) =>
                    field.options?.find((option) => option.value === answer)?.label ?? answer;
                  const answer = Array.isArray(value)
                    ? value.map(label).join(', ')
                    : value === undefined || value === ''
                      ? 'Not provided'
                      : label(String(value));
                  return (
                    <div key={field.id}>
                      <dt className="text-sm text-muted-foreground">{field.label}</dt>
                      <dd className="mt-1 whitespace-pre-wrap break-words">
                        {answer || 'Not provided'}
                      </dd>
                    </div>
                  );
                })}
              </dl>
            </section>
          ))}
        </section>
        <div className="space-y-8">
          <form
            noValidate
            className="space-y-4 rounded-lg border p-5"
            onSubmit={form.handleSubmit(save)}
          >
            <h2 className="text-lg font-semibold">Manage request</h2>
            <div className="space-y-2">
              <Label htmlFor="detail-status">Status</Label>
              <select
                id="detail-status"
                disabled={busy || conflict}
                {...form.register('status')}
                className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
              >
                {[item.status, ...transitions[item.status]].map((status) => (
                  <option key={status} value={status}>
                    {(item.status === 'processed' || item.status === 'declined') &&
                    status === 'in_progress'
                      ? 'Reopen: In progress'
                      : statusLabels[status]}
                  </option>
                ))}
              </select>
              {form.formState.errors.status && (
                <p role="alert" className="text-sm text-destructive">
                  {form.formState.errors.status.message}
                </p>
              )}
            </div>
            <div className="space-y-2">
              <Label htmlFor="detail-note">Private note</Label>
              <Textarea
                id="detail-note"
                rows={6}
                maxLength={4000}
                disabled={busy}
                readOnly={conflict}
                aria-describedby="detail-note-help detail-note-error"
                aria-invalid={!!form.formState.errors.note}
                {...form.register('note')}
              />
              <p id="detail-note-help" className="text-sm text-muted-foreground">
                Visible only to authorized administrators.
              </p>
              {form.formState.errors.note && (
                <p id="detail-note-error" role="alert" className="text-sm text-destructive">
                  {form.formState.errors.note.message}
                </p>
              )}
            </div>
            <Button type="submit" disabled={busy || conflict}>
              {busy ? 'Saving…' : 'Save changes'}
            </Button>
            {conflict && (
              <Button
                type="button"
                variant="outline"
                disabled={busy}
                onClick={() => setRefresh((value) => value + 1)}
              >
                Reload latest request
              </Button>
            )}
          </form>
          <section className="space-y-3 rounded-lg border p-5">
            <h2 className="text-lg font-semibold">Business notification</h2>
            <p className="text-sm">
              Status:{' '}
              {expired
                ? 'Delivery confirmation timed out; retry available'
                : item.notification.status}
            </p>
            <p className="text-sm text-muted-foreground">
              Delivery attempts: {item.notification.attempts}
            </p>
            {item.notification.lastError && (
              <p className="break-words text-sm text-destructive">{item.notification.lastError}</p>
            )}
            {item.notification.status === 'sent' ? (
              <p className="text-sm text-muted-foreground">
                The email provider accepted this notification. Inbox delivery is not guaranteed.
              </p>
            ) : (
              <p className="text-sm text-muted-foreground">
                The request is saved. Pending or failed notifications need a manual retry; no
                automatic delivery is promised.
              </p>
            )}
            {retryable && (
              <>
                <p className="text-sm text-muted-foreground">
                  A retry may send a duplicate if a previous delivery succeeded without a recorded
                  confirmation.
                </p>
                <Button
                  type="button"
                  variant="outline"
                  disabled={busy}
                  onClick={() => void retry()}
                >
                  Retry notification
                </Button>
              </>
            )}
            {item.notification.status === 'sending' && !expired && (
              <output className="text-sm text-muted-foreground">
                A delivery attempt is in progress. Retry becomes available if delivery confirmation
                times out.
              </output>
            )}
          </section>
        </div>
      </div>
      <section className="space-y-3 border-t pt-6">
        <h2 className="text-lg font-semibold">Status history</h2>
        <ol className="space-y-3">
          {item.history.map((event, index) => (
            <li key={`${event.createdAt}-${index}`} className="text-sm">
              <span className="font-medium">
                {event.from ? `${statusLabels[event.from]} → ` : ''}
                {statusLabels[event.to]}
              </span>
              <span className="ml-3 text-muted-foreground">
                <time dateTime={event.createdAt}>{new Date(event.createdAt).toLocaleString()}</time>
                {event.actorId ? ` by ${event.actorId}` : ' from submission'}
              </span>
            </li>
          ))}
        </ol>
      </section>
    </article>
  );
}
