// @polsia:user-owned — PayPal REST helpers (Orders v2 + webhook verify).
import 'server-only';

import { getPaymentGatewaySettings } from '@/lib/business/payments/settings';

type PayPalToken = { access_token: string; expires_at: number };
let cachedToken: PayPalToken | null = null;

function apiBase(mode: 'sandbox' | 'live') {
  return mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com';
}

async function getAccessToken() {
  const settings = await getPaymentGatewaySettings();
  if (!settings.paypalClientId || !settings.paypalClientSecret) {
    throw new Error('PayPal credentials are not configured.');
  }
  const now = Date.now();
  if (cachedToken && cachedToken.expires_at > now + 30_000) return { token: cachedToken.access_token, settings };

  const auth = Buffer.from(`${settings.paypalClientId}:${settings.paypalClientSecret}`).toString(
    'base64',
  );
  const response = await fetch(`${apiBase(settings.mode)}/v1/oauth2/token`, {
    method: 'POST',
    headers: {
      Authorization: `Basic ${auth}`,
      'Content-Type': 'application/x-www-form-urlencoded',
    },
    body: 'grant_type=client_credentials',
    signal: AbortSignal.timeout(30_000),
  });
  if (!response.ok) {
    const text = await response.text();
    throw new Error(`PayPal token failed (${response.status}): ${text.slice(0, 300)}`);
  }
  const json = (await response.json()) as { access_token: string; expires_in: number };
  cachedToken = {
    access_token: json.access_token,
    expires_at: now + json.expires_in * 1000,
  };
  return { token: cachedToken.access_token, settings };
}

export async function paypalRequest<T>(
  path: string,
  init?: RequestInit & { idempotencyKey?: string },
): Promise<{ status: number; body: T; raw: string }> {
  const { token, settings } = await getAccessToken();
  const headers: Record<string, string> = {
    Authorization: `Bearer ${token}`,
    'Content-Type': 'application/json',
    Prefer: 'return=representation',
    ...(init?.headers as Record<string, string> | undefined),
  };
  if (init?.idempotencyKey) headers['PayPal-Request-Id'] = init.idempotencyKey;

  const response = await fetch(`${apiBase(settings.mode)}${path}`, {
    ...init,
    headers,
    signal: init?.signal ?? AbortSignal.timeout(45_000),
  });
  const raw = await response.text();
  let body = {} as T;
  try {
    body = raw ? (JSON.parse(raw) as T) : ({} as T);
  } catch {
    body = {} as T;
  }
  return { status: response.status, body, raw };
}

export async function createPayPalOrder(input: {
  reference: string;
  amountCents: number;
  description: string;
  returnUrl: string;
  cancelUrl: string;
  idempotencyKey: string;
}) {
  const value = (input.amountCents / 100).toFixed(2);
  const result = await paypalRequest<{ id?: string; status?: string; links?: Array<{ rel: string; href: string }> }>(
    '/v2/checkout/orders',
    {
      method: 'POST',
      idempotencyKey: input.idempotencyKey,
      body: JSON.stringify({
        intent: 'CAPTURE',
        purchase_units: [
          {
            reference_id: input.reference,
            description: input.description.slice(0, 120),
            custom_id: input.reference,
            amount: {
              currency_code: 'USD',
              value,
            },
          },
        ],
        application_context: {
          brand_name: 'Mintbloomproclean',
          landing_page: 'NO_PREFERENCE',
          user_action: 'PAY_NOW',
          return_url: input.returnUrl,
          cancel_url: input.cancelUrl,
          shipping_preference: 'NO_SHIPPING',
        },
      }),
    },
  );
  if (result.status >= 300 || !result.body.id) {
    throw new Error(`PayPal create order failed (${result.status}): ${result.raw.slice(0, 400)}`);
  }
  return result.body;
}

export async function capturePayPalOrder(paypalOrderId: string) {
  return paypalRequest<{
    id?: string;
    status?: string;
    purchase_units?: Array<{
      payments?: {
        captures?: Array<{ id?: string; status?: string; amount?: { value?: string } }>;
      };
    }>;
    payment_source?: { paypal?: unknown; venmo?: unknown };
  }>(`/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}/capture`, {
    method: 'POST',
    body: '{}',
    idempotencyKey: `capture-${paypalOrderId}`,
  });
}

export async function getPayPalOrder(paypalOrderId: string) {
  return paypalRequest<Record<string, unknown>>(
    `/v2/checkout/orders/${encodeURIComponent(paypalOrderId)}`,
    { method: 'GET' },
  );
}

export async function verifyPayPalWebhookSignature(input: {
  headers: Headers;
  rawBody: string;
}) {
  const settings = await getPaymentGatewaySettings();
  if (!settings.paypalWebhookId) {
    return { ok: false as const, reason: 'webhook_id_missing' };
  }
  const transmissionId = input.headers.get('paypal-transmission-id');
  const transmissionTime = input.headers.get('paypal-transmission-time');
  const certUrl = input.headers.get('paypal-cert-url');
  const authAlgo = input.headers.get('paypal-auth-algo');
  const transmissionSig = input.headers.get('paypal-transmission-sig');
  if (!transmissionId || !transmissionTime || !certUrl || !authAlgo || !transmissionSig) {
    return { ok: false as const, reason: 'missing_headers' };
  }

  let webhookEvent: unknown;
  try {
    webhookEvent = JSON.parse(input.rawBody);
  } catch {
    return { ok: false as const, reason: 'invalid_json' };
  }

  const result = await paypalRequest<{ verification_status?: string }>('/v1/notifications/verify-webhook-signature', {
    method: 'POST',
    body: JSON.stringify({
      transmission_id: transmissionId,
      transmission_time: transmissionTime,
      cert_url: certUrl,
      auth_algo: authAlgo,
      transmission_sig: transmissionSig,
      webhook_id: settings.paypalWebhookId,
      webhook_event: webhookEvent,
    }),
  });

  if (result.status >= 300 || result.body.verification_status !== 'SUCCESS') {
    return { ok: false as const, reason: 'verification_failed', status: result.status, body: result.body };
  }
  return { ok: true as const, event: webhookEvent };
}

export function dollarsToCents(value: string | undefined) {
  if (!value) return null;
  const parsed = Number.parseFloat(value);
  if (!Number.isFinite(parsed)) return null;
  return Math.round(parsed * 100);
}
