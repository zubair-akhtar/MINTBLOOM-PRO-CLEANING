// @polsia:user-owned — admin payment / quote orders list.
'use client';

import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { apiFetch } from '@/lib/api-client';
import { bookingPaymentOrderSchema } from '@/lib/contracts/payments';
import { Badge } from '@/components/ui/badge';
import { z } from 'zod';

const listSchema = z.object({ orders: z.array(bookingPaymentOrderSchema) });
type Order = z.infer<typeof bookingPaymentOrderSchema>;

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function statusBadge(status: Order['status']) {
  if (status === 'testing_payment')
    return <Badge className="bg-amber-100 text-amber-900 hover:bg-amber-100">Testing payment</Badge>;
  if (status === 'paid')
    return <Badge className="bg-emerald-100 text-emerald-900 hover:bg-emerald-100">Paid</Badge>;
  if (status === 'quote_requested')
    return <Badge variant="secondary">Quote requested</Badge>;
  if (status === 'pending_payment')
    return <Badge variant="outline">Payment pending</Badge>;
  if (status === 'failed') return <Badge variant="destructive">Failed</Badge>;
  return <Badge variant="outline">{status}</Badge>;
}

export function AdminOrders() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    apiFetch('/api/admin/orders', { schema: listSchema })
      .then((data) => setOrders(data.orders))
      .catch(() => toast.error('Could not load orders.'))
      .finally(() => setLoading(false));
  }, []);

  if (loading) return <p className="text-muted-foreground">Loading orders…</p>;

  const visible =
    filter === 'all' ? orders : orders.filter((order) => order.status === filter);

  return (
    <div className="grid gap-4">
      <div className="flex flex-wrap gap-2">
        {(
          [
            ['all', 'All'],
            ['quote_requested', 'Quotes'],
            ['pending_payment', 'Pending'],
            ['paid', 'Paid'],
            ['testing_payment', 'Testing'],
            ['failed', 'Failed'],
          ] as const
        ).map(([value, label]) => (
          <button
            key={value}
            type="button"
            onClick={() => setFilter(value)}
            className={`rounded-full border px-3 py-1 text-sm ${
              filter === value
                ? 'border-primary bg-primary text-primary-foreground'
                : 'border-border text-muted-foreground'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <p className="text-sm text-muted-foreground">No orders yet.</p>
      ) : (
        visible.map((order) => (
          <article
            key={order.id}
            className="grid gap-2 rounded-xl border border-border bg-card p-4 sm:grid-cols-[1fr_auto]"
          >
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <p className="font-semibold">{order.reference}</p>
                {statusBadge(order.status)}
              </div>
              <p className="text-sm text-muted-foreground">
                {order.fullName} · {order.email} · {order.phone}
              </p>
              <p className="text-sm">
                {order.serviceId} · {order.channel} ·{' '}
                {order.preferredDate ? `date ${order.preferredDate}` : 'no date'}
                {order.couponCode ? ` · coupon ${order.couponCode}` : ''}
                {order.paymentMethod ? ` · ${order.paymentMethod}` : ''}
              </p>
              {order.notes ? (
                <p className="text-sm text-muted-foreground">Notes: {order.notes}</p>
              ) : null}
            </div>
            <div className="text-right">
              <p className="text-lg font-semibold">{money(order.amountCents)}</p>
              <p className="text-xs text-muted-foreground">
                {new Date(order.createdAt).toLocaleString()}
              </p>
            </div>
          </article>
        ))
      )}
    </div>
  );
}
