// @polsia:user-owned — capture PayPal order after buyer approval.
import { NextResponse } from 'next/server';
import { captureOnlineOrder, logPaymentEvent } from '@/lib/business/payments/orders';
import { capturePaypalOrderSchema } from '@/lib/contracts/payments';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }

  const parsed = capturePaypalOrderSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  try {
    const order = await captureOnlineOrder(parsed.data.paypalOrderId);
    return NextResponse.json({ ok: true, order }, { headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'capture_failed';
    await logPaymentEvent({
      eventType: 'paypal_capture_error',
      payload: { message, paypalOrderId: parsed.data.paypalOrderId },
      riskFlag: true,
      message,
    });
    return NextResponse.json({ error: message }, { status: 400, headers });
  }
}
