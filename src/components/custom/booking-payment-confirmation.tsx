// @polsia:user-owned — confirms the hosted booking checkout before tracking Purchase.
'use client';

import { useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';
import { apiFetch } from '@/lib/api-client';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';
import { checkoutVerificationResultSchema } from '@/lib/stripe-billing/schema';

type ConfirmationState = 'checking' | 'confirmed' | 'pending' | 'unavailable' | 'invalid';

function trackPurchaseOnce(sessionId: string, amountUsd: number) {
  const storageKey = `mintbloom-meta-purchase:${sessionId}`;
  try {
    if (window.localStorage.getItem(storageKey) === 'sent') return;
  } catch {
    trackMetaPixelEvent('Purchase', { value: amountUsd, currency: 'USD' });
    return;
  }

  if (trackMetaPixelEvent('Purchase', { value: amountUsd, currency: 'USD' })) {
    try {
      window.localStorage.setItem(storageKey, 'sent');
    } catch {
      // The event is already queued; a storage failure must not send it twice.
    }
  }
}

export function BookingPaymentConfirmation() {
  const searchParams = useSearchParams();
  const sessionId = searchParams.get('session_id');
  const [state, setState] = useState<ConfirmationState>(sessionId ? 'checking' : 'invalid');

  useEffect(() => {
    if (!sessionId) {
      setState('invalid');
      return;
    }

    let active = true;
    apiFetch(`/api/stripe-billing/verify?session_id=${encodeURIComponent(sessionId)}`, {
      schema: checkoutVerificationResultSchema,
    })
      .then((verification) => {
        if (!active) return;
        if (!verification.verified || !verification.payment) {
          setState('pending');
          return;
        }

        const paidTotalUsd = verification.payment.gross_amount_usd;
        if (typeof paidTotalUsd === 'number' && Number.isFinite(paidTotalUsd) && paidTotalUsd > 0) {
          trackPurchaseOnce(sessionId, paidTotalUsd);
        }
        setState('confirmed');
      })
      .catch(() => {
        if (active) setState('unavailable');
      });

    return () => {
      active = false;
    };
  }, [sessionId]);

  if (state === 'checking') {
    return (
      <p className="mt-4 text-muted-foreground" aria-live="polite">
        Checking your payment…
      </p>
    );
  }
  if (state === 'confirmed') {
    return (
      <output className="mt-4 block text-muted-foreground">
        Your payment is confirmed. Mintbloom will follow up with your booking details.
      </output>
    );
  }
  if (state === 'pending') {
    return (
      <output className="mt-4 block text-muted-foreground">
        Your payment is not confirmed yet. Refresh this page in a moment to check again.
      </output>
    );
  }
  if (state === 'invalid') {
    return (
      <p className="mt-4 text-muted-foreground" role="alert">
        This confirmation link is missing its checkout session.
      </p>
    );
  }
  return (
    <p className="mt-4 text-muted-foreground" role="alert">
      We could not check the payment right now. Refresh this page to try again.
    </p>
  );
}
