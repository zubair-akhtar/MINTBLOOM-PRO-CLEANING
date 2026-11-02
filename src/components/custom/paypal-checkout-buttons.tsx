// @polsia:user-owned — PayPal JS SDK buttons (PayPal + optional Venmo).
'use client';

import { useEffect, useRef, useState } from 'react';
import { Lock } from 'lucide-react';

declare global {
  interface Window {
    paypal?: {
      Buttons: (config: Record<string, unknown>) => { render: (el: HTMLElement) => Promise<void> };
      FUNDING?: { PAYPAL?: string; VENMO?: string };
    };
  }
}

type Props = {
  clientId: string;
  mode: 'sandbox' | 'live';
  venmoEnabled: boolean;
  disabled?: boolean;
  onCreateOrder: () => Promise<string>;
  onApprove: (paypalOrderId: string) => Promise<void>;
  onError?: (message: string) => void;
};

export function PaypalCheckoutButtons({
  clientId,
  mode,
  venmoEnabled,
  disabled,
  onCreateOrder,
  onApprove,
  onError,
}: Props) {
  const hostRef = useRef<HTMLDivElement>(null);
  const [ready, setReady] = useState(false);
  const [scriptError, setScriptError] = useState('');

  useEffect(() => {
    if (!clientId || disabled) return;
    const existing = document.querySelector<HTMLScriptElement>('script[data-mintbloom-paypal]');
    if (existing && window.paypal) {
      setReady(true);
      return;
    }

    const script = document.createElement('script');
    const components = 'buttons';
    const enableFunding = venmoEnabled ? '&enable-funding=venmo' : '';
    script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(clientId)}&currency=USD&intent=capture&components=${components}${enableFunding}`;
    script.async = true;
    script.dataset.mintbloomPaypal = 'true';
    script.onload = () => setReady(true);
    script.onerror = () => setScriptError('Could not load the secure PayPal checkout.');
    document.body.appendChild(script);
  }, [clientId, disabled, venmoEnabled, mode]);

  useEffect(() => {
    if (!ready || !hostRef.current || !window.paypal || disabled) return;
    hostRef.current.innerHTML = '';

    const buttons = window.paypal.Buttons({
      style: {
        layout: 'vertical',
        color: 'gold',
        shape: 'rect',
        label: 'pay',
        height: 48,
      },
      createOrder: async () => onCreateOrder(),
      onApprove: async (data: { orderID?: string }) => {
        if (!data.orderID) {
          onError?.('PayPal did not return an order id.');
          return;
        }
        await onApprove(data.orderID);
      },
      onError: (err: unknown) => {
        onError?.(err instanceof Error ? err.message : 'PayPal checkout failed.');
      },
      onCancel: () => onError?.('Payment was cancelled. You can try again when ready.'),
    });

    void buttons.render(hostRef.current);
  }, [ready, disabled, onApprove, onCreateOrder, onError]);

  if (disabled) return null;

  return (
    <div className="grid gap-3 rounded-2xl border border-emerald-900/10 bg-[#f7f1e3] p-4 shadow-none">
      <div className="flex items-start gap-3">
        <span className="mt-0.5 flex size-9 items-center justify-center rounded-full bg-emerald-950 text-emerald-50">
          <Lock className="size-4" aria-hidden />
        </span>
        <div>
          <p className="font-semibold text-emerald-950">Secure checkout</p>
          <p className="text-sm text-emerald-950/70">
            Payments are processed by PayPal{venmoEnabled ? ' or Venmo' : ''}. Mintbloom never stores
            your full card number.
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-3 text-xs font-medium uppercase tracking-wide text-emerald-950/60">
        <span className="rounded-md border border-emerald-900/15 bg-white px-2 py-1">PayPal</span>
        {venmoEnabled ? (
          <span className="rounded-md border border-emerald-900/15 bg-white px-2 py-1">Venmo</span>
        ) : null}
        <span>Encrypted · Buyer protection</span>
      </div>
      {scriptError ? <p className="text-sm text-destructive">{scriptError}</p> : null}
      <div ref={hostRef} className="min-h-12" />
      {!ready && !scriptError ? (
        <p className="text-sm text-muted-foreground">Loading secure payment options…</p>
      ) : null}
    </div>
  );
}
