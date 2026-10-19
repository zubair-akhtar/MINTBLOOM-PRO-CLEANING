// @polsia:user-owned — Customize this screen for your business.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import type { z } from 'zod';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin, useSession } from '@/lib/auth-client';
import {
  type ListQuery,
  listQuerySchema,
  listResponseSchema,
  statusLabels,
  statusSchema,
} from '@/modules/service-intake/contracts';

export function RequestList() {
  const { isPending, data: session } = useSession();
  const isAdmin = useIsAdmin();
  const [query, setQuery] = useState<ListQuery>({ q: '', page: 1, pageSize: 20 });
  const [search, setSearch] = useState('');
  const [status, setStatus] = useState('');
  const [data, setData] = useState<z.infer<typeof listResponseSchema> | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [refresh, setRefresh] = useState(0);
  // biome-ignore lint/correctness/useExhaustiveDependencies: The refresh counter explicitly reloads the current resource.
  useEffect(() => {
    if (!isAdmin || isPending) {
      setData(null);
      return;
    }
    let active = true;
    const controller = new AbortController();
    setLoading(true);
    setError('');
    setData(null);
    const values = listQuerySchema.parse(query);
    const params = new URLSearchParams({
      q: values.q,
      page: String(values.page),
      pageSize: String(values.pageSize),
    });
    if (values.status) params.set('status', values.status);
    void apiFetch(`/api/admin/service-intake?${params}`, {
      schema: listResponseSchema,
      signal: controller.signal,
    })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setError('Requests could not be loaded. Check your access and try again.');
      })
      .finally(() => {
        if (active) setLoading(false);
      });
    return () => {
      active = false;
      controller.abort();
    };
  }, [isAdmin, isPending, query, refresh]);
  if (isPending) return <output>Checking access…</output>;
  if (!isAdmin || !session)
    return <p role="alert">Administrator access is required to view service requests.</p>;
  return (
    <section className="space-y-6">
      <header>
        <h1 className="text-3xl font-semibold tracking-tight">Service requests</h1>
        <p className="mt-2 text-muted-foreground">
          Review incoming requests and keep track of the next step.
        </p>
      </header>
      <form
        className="flex flex-wrap items-end gap-3"
        onSubmit={(event) => {
          event.preventDefault();
          setQuery(
            listQuerySchema.parse({
              q: search.trim(),
              status: status || undefined,
              page: 1,
              pageSize: 20,
            }),
          );
        }}
      >
        <div className="min-w-48 flex-1 space-y-2">
          <Label htmlFor="request-search">Reference or contact</Label>
          <Input
            id="request-search"
            name="q"
            value={search}
            maxLength={120}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search requests"
          />
        </div>
        <div className="space-y-2">
          <Label htmlFor="request-status">Status</Label>
          <select
            id="request-status"
            name="status"
            value={status}
            onChange={(event) => setStatus(event.target.value)}
            className="h-10 rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          >
            <option value="">All statuses</option>
            {statusSchema.options.map((value) => (
              <option key={value} value={value}>
                {statusLabels[value]}
              </option>
            ))}
          </select>
        </div>
        <Button type="submit">Search</Button>
      </form>
      {loading && <output>Loading requests…</output>}
      {error && (
        <div role="alert" className="space-y-3">
          <p className="text-destructive">{error}</p>
          <Button type="button" variant="outline" onClick={() => setRefresh((value) => value + 1)}>
            Try again
          </Button>
        </div>
      )}
      {data && (
        <>
          <p aria-live="polite" className="text-sm text-muted-foreground">
            {data.total} {data.total === 1 ? 'request' : 'requests'}
          </p>
          {data.items.length === 0 ? (
            <p className="rounded-lg border p-6">No requests match these filters.</p>
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-left text-sm">
                <caption className="sr-only">Service requests matching your filters</caption>
                <thead className="bg-muted">
                  <tr>
                    {['Request', 'Contact', 'Status', 'Notification', 'Received'].map((label) => (
                      <th key={label} scope="col" className="p-4 font-medium">
                        {label}
                      </th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {data.items.map((item) => (
                    <tr key={item.id} className="border-t">
                      <td className="p-4">
                        <Link
                          href={`/admin/service-requests/${encodeURIComponent(item.id)}`}
                          className="font-medium underline underline-offset-4"
                        >
                          {item.reference}
                        </Link>
                        <p className="mt-1 text-muted-foreground">{item.formTitle}</p>
                      </td>
                      <td className="break-all p-4">{item.contact}</td>
                      <td className="whitespace-nowrap p-4">{statusLabels[item.status]}</td>
                      <td className="p-4">
                        {item.notification.status === 'sending' &&
                        item.notification.leaseUntil &&
                        Date.parse(item.notification.leaseUntil) <= Date.now()
                          ? 'Delivery confirmation timed out; retry available'
                          : item.notification.status}
                      </td>
                      <td className="whitespace-nowrap p-4">
                        <time dateTime={item.createdAt}>
                          {new Date(item.createdAt).toLocaleString()}
                        </time>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
          <nav aria-label="Request pages" className="flex items-center gap-3">
            <Button
              type="button"
              variant="outline"
              disabled={loading || data.page <= 1}
              onClick={() => setQuery((value) => ({ ...value, page: value.page - 1 }))}
            >
              Previous page
            </Button>
            <span className="text-sm">
              Page {data.page} of {Math.max(1, Math.ceil(data.total / data.pageSize))}
            </span>
            <Button
              type="button"
              variant="outline"
              disabled={loading || data.page >= 1000 || data.page * data.pageSize >= data.total}
              onClick={() => setQuery((value) => ({ ...value, page: value.page + 1 }))}
            >
              Next page
            </Button>
          </nav>
        </>
      )}
    </section>
  );
}
