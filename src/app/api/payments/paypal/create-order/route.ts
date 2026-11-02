// @polsia:user-owned — create PayPal order for online booking.
import { NextResponse } from 'next/server';
import { createOnlinePayPalOrder, logPaymentEvent } from '@/lib/business/payments/orders';
import { createPaypalOrderSchema } from '@/lib/contracts/payments';
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

  const parsed = createPaypalOrderSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  try {
    const result = await createOnlinePayPalOrder(parsed.data);
    return NextResponse.json(result, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_order_failed';
    await logPaymentEvent({
      eventType: 'paypal_create_order_error',
      payload: { message, body: parsed.data },
      riskFlag: true,
      message,
    });
    return NextResponse.json({ error: message }, { status: 400, headers });
  }
}
