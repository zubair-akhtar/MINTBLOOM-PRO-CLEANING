// @polsia:user-owned — PayPal booking confirmation / status panel.
'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import { apiFetch } from '@/lib/api-client';
import { bookingPaymentOrderSchema } from '@/lib/contracts/payments';
import { formatUsdFromCents } from '@/lib/business/pricing/money';
import { z } from 'zod';

const responseSchema = z.object({ order: bookingPaymentOrderSchema });

export function BookingPaymentConfirmation() {
  const params = useSearchParams();
  const reference = params.get('ref');
  const paypalToken = params.get('token');
  const [message, setMessage] = useState('Checking your booking…');
  const [status, setStatus] = useState<'loading' | 'ok' | 'pending' | 'error'>('loading');
  const [total, setTotal] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function run() {
      try {
        if (paypalToken) {
          const captured = await apiFetch('/api/payments/paypal/capture-order', {
            method: 'POST',
            body: JSON.stringify({ paypalOrderId: paypalToken }),
            schema: z.object({ ok: z.literal(true), order: bookingPaymentOrderSchema }),
          });
          if (cancelled) return;
          setTotal(formatUsdFromCents(captured.order.amountCents));
          setStatus('ok');
          setMessage(
            captured.order.status === 'testing_payment'
              ? 'Sandbox payment received. Mintbloom will follow up with booking details.'
              : 'Payment confirmed. Mintbloom will follow up with your booking details.',
          );
          return;
        }

        if (!reference) {
          setStatus('error');
          setMessage('Missing booking reference.');
          return;
        }

        const result = await apiFetch(
          `/api/payments/order-by-ref?ref=${encodeURIComponent(reference)}`,
          { schema: responseSchema, cache: 'no-store' },
        );
        if (cancelled) return;
        setTotal(formatUsdFromCents(result.order.amountCents));
        if (result.order.status === 'paid' || result.order.status === 'testing_payment') {
          setStatus('ok');
          setMessage(
            result.order.status === 'testing_payment'
              ? 'Sandbox payment recorded. We emailed your invoice.'
              : 'Payment confirmed. We emailed your invoice.',
          );
        } else if (result.order.status === 'quote_requested') {
          setStatus('ok');
          setMessage('Quote request received. Mintbloom will confirm your final price.');
        } else {
          setStatus('pending');
          setMessage('Your payment is still settling. Refresh this page in a moment.');
        }
      } catch {
        if (!cancelled) {
          setStatus('error');
          setMessage('We could not confirm the booking right now. Refresh to try again.');
        }
      }
    }

    void run();
    return () => {
      cancelled = true;
    };
  }, [paypalToken, reference]);

  return (
    <div className="mt-6 rounded-2xl border border-border bg-card p-6">
      <p className="text-muted-foreground">{message}</p>
      {total ? <p className="mt-3 text-2xl font-semibold">{total}</p> : null}
      {reference ? (
        <p className="mt-2 text-sm text-muted-foreground">Reference {reference}</p>
      ) : null}
      {status === 'pending' ? (
        <p className="mt-4 text-sm text-muted-foreground">Checking payment status…</p>
      ) : null}
    </div>
  );
}
