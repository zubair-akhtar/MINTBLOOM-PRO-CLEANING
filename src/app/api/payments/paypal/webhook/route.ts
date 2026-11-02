// @polsia:user-owned — PayPal webhook receiver with signature verification.
import { NextResponse } from 'next/server';
import { dollarsToCents, verifyPayPalWebhookSignature } from '@/lib/business/payments/paypal';
import {
  finalizeCapturedOrder,
  logPaymentEvent,
} from '@/lib/business/payments/orders';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const rawBody = await request.text();
  const verified = await verifyPayPalWebhookSignature({
    headers: request.headers,
    rawBody,
  });

  if (!verified.ok) {
    await logPaymentEvent({
      eventType: 'paypal_webhook_rejected',
      payload: verified,
      riskFlag: true,
      message: verified.reason,
      httpStatus: 400,
    });
    return NextResponse.json({ error: verified.reason }, { status: 400 });
  }

  const event = verified.event as {
    event_type?: string;
    resource?: {
      id?: string;
      status?: string;
      supplementary_data?: { related_ids?: { order_id?: string } };
      amount?: { value?: string };
      custom_id?: string;
    };
  };

  await logPaymentEvent({
    eventType: `paypal_webhook_${event.event_type ?? 'unknown'}`,
    payload: event,
    httpStatus: 200,
  });

  if (event.event_type === 'PAYMENT.CAPTURE.COMPLETED') {
    const paypalOrderId = event.resource?.supplementary_data?.related_ids?.order_id;
    const captureId = event.resource?.id;
    if (paypalOrderId) {
      const order = await prisma.bookingPaymentOrder.findUnique({ where: { paypalOrderId } });
      if (order) {
        try {
          await finalizeCapturedOrder(order, {
            captureId,
            amountCents: dollarsToCents(event.resource?.amount?.value),
            paymentMethod: 'paypal',
            raw: event,
          });
        } catch (error) {
          await logPaymentEvent({
            orderId: order.id,
            eventType: 'paypal_webhook_finalize_error',
            payload: { message: error instanceof Error ? error.message : 'error', event },
            riskFlag: true,
          });
        }
      }
    }
  }

  return NextResponse.json({ received: true });
}
