// @polsia:user-owned — booking payment order create / capture / logging.
import 'server-only';

import { randomBytes } from 'node:crypto';
import type { BookingPaymentOrder } from '@prisma/client';
import { findValidCoupon } from '@/lib/business/payments/coupons';
import {
  capturePayPalOrder,
  createPayPalOrder,
  dollarsToCents,
} from '@/lib/business/payments/paypal';
import { getPaymentGatewaySettings, getPublicPaymentConfig } from '@/lib/business/payments/settings';
import { sendBookingInvoiceEmails, sendQuoteAdminEmail } from '@/lib/business/payments/invoices';
import type {
  CreatePaypalOrderInput,
  CreateQuoteRequestInput,
} from '@/lib/contracts/payments';
import { prisma } from '@/lib/db';
import { env } from '@/lib/env';

function makeReference() {
  return `MB-${Date.now().toString(36).toUpperCase()}-${randomBytes(2).toString('hex').toUpperCase()}`;
}

export function serializeOrder(order: BookingPaymentOrder) {
  return {
    id: order.id,
    reference: order.reference,
    channel: order.channel,
    status: order.status,
    fullName: order.fullName,
    email: order.email,
    phone: order.phone,
    preferredDate: order.preferredDate ? order.preferredDate.toISOString().slice(0, 10) : null,
    notes: order.notes,
    serviceId: order.serviceId,
    subtotalCents: order.subtotalCents,
    discountCents: order.discountCents,
    taxCents: order.taxCents,
    amountCents: order.amountCents,
    couponCode: order.couponCode,
    paypalOrderId: order.paypalOrderId,
    paymentMethod: order.paymentMethod,
    createdAt: order.createdAt.toISOString(),
    updatedAt: order.updatedAt.toISOString(),
  };
}

export async function logPaymentEvent(input: {
  orderId?: string | null;
  eventType: string;
  payload: unknown;
  httpStatus?: number;
  riskFlag?: boolean;
  message?: string;
}) {
  return prisma.paymentEventLog.create({
    data: {
      orderId: input.orderId ?? null,
      eventType: input.eventType,
      payload: input.payload as object,
      httpStatus: input.httpStatus ?? null,
      riskFlag: input.riskFlag ?? false,
      message: input.message ?? '',
    },
  });
}

async function resolveAmounts(
  channel: 'quote' | 'online',
  subtotalCents: number,
  taxCents: number,
  amountCents: number,
  couponCode?: string | null,
) {
  let discountCents = 0;
  let couponId: string | null = null;
  let normalizedCode: string | null = null;
  if (couponCode) {
    const validated = await findValidCoupon(couponCode, channel, subtotalCents);
    if (!validated.valid) throw new Error(validated.error);
    discountCents = validated.discountCents;
    couponId = validated.coupon.id;
    normalizedCode = validated.code;
  }
  const expected = Math.max(0, subtotalCents - discountCents + taxCents);
  if (Math.abs(expected - amountCents) > 1) {
    throw new Error('Amount mismatch after coupon. Refresh the estimate and try again.');
  }
  return { discountCents, couponId, couponCode: normalizedCode, amountCents: expected };
}

export async function createQuoteOrder(input: CreateQuoteRequestInput) {
  const existing = await prisma.bookingPaymentOrder.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing) return serializeOrder(existing);

  const amounts = await resolveAmounts(
    'quote',
    input.subtotalCents,
    input.taxCents,
    input.amountCents,
    input.couponCode,
  );

  const order = await prisma.bookingPaymentOrder.create({
    data: {
      reference: makeReference(),
      channel: 'quote',
      status: 'quote_requested',
      fullName: input.customer.fullName,
      email: input.customer.email,
      phone: input.customer.phone,
      addressLine1: input.customer.addressLine1,
      addressLine2: input.customer.addressLine2 || null,
      city: input.customer.city,
      state: input.customer.state,
      zip: input.customer.zip || '',
      preferredDate: input.preferredDate ? new Date(input.preferredDate) : null,
      notes: input.notes || '',
      serviceId: input.serviceId,
      estimateSnapshot: input.estimateSnapshot as object,
      subtotalCents: input.subtotalCents,
      discountCents: amounts.discountCents,
      taxCents: input.taxCents,
      amountCents: amounts.amountCents,
      couponId: amounts.couponId,
      couponCode: amounts.couponCode,
      idempotencyKey: input.idempotencyKey,
    },
  });

  if (amounts.couponId) {
    await prisma.coupon.update({
      where: { id: amounts.couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }

  await logPaymentEvent({
    orderId: order.id,
    eventType: 'quote_requested',
    payload: { reference: order.reference },
  });

  await sendQuoteAdminEmail(order);
  return serializeOrder(order);
}

export async function createOnlinePayPalOrder(input: CreatePaypalOrderInput) {
  const config = await getPublicPaymentConfig();
  if (!config.onlinePaymentsAvailable) {
    throw new Error('Online payments are currently unavailable.');
  }

  const existing = await prisma.bookingPaymentOrder.findUnique({
    where: { idempotencyKey: input.idempotencyKey },
  });
  if (existing?.paypalOrderId) {
    return { order: serializeOrder(existing), paypalOrderId: existing.paypalOrderId };
  }

  const amounts = await resolveAmounts(
    'online',
    input.subtotalCents,
    input.taxCents,
    input.amountCents,
    input.couponCode,
  );

  const reference = makeReference();
  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/$/, '');
  const paypalOrder = await createPayPalOrder({
    reference,
    amountCents: amounts.amountCents,
    description: `Mintbloom cleaning — ${input.serviceId}`,
    returnUrl: `${appUrl}/book/confirmed?ref=${encodeURIComponent(reference)}`,
    cancelUrl: `${appUrl}/book?payment=cancelled`,
    idempotencyKey: input.idempotencyKey,
  });

  const order = existing
    ? await prisma.bookingPaymentOrder.update({
        where: { id: existing.id },
        data: {
          paypalOrderId: paypalOrder.id,
          status: 'pending_payment',
          amountCents: amounts.amountCents,
          discountCents: amounts.discountCents,
          couponId: amounts.couponId,
          couponCode: amounts.couponCode,
        },
      })
    : await prisma.bookingPaymentOrder.create({
        data: {
          reference,
          channel: 'online',
          status: 'pending_payment',
          fullName: input.customer.fullName,
          email: input.customer.email,
          phone: input.customer.phone,
          addressLine1: input.customer.addressLine1,
          addressLine2: input.customer.addressLine2 || null,
          city: input.customer.city,
          state: input.customer.state,
          zip: input.customer.zip || '',
          preferredDate: new Date(input.preferredDate),
          notes: input.notes || '',
          serviceId: input.serviceId,
          estimateSnapshot: input.estimateSnapshot as object,
          subtotalCents: input.subtotalCents,
          discountCents: amounts.discountCents,
          taxCents: input.taxCents,
          amountCents: amounts.amountCents,
          couponId: amounts.couponId,
          couponCode: amounts.couponCode,
          paypalOrderId: paypalOrder.id,
          idempotencyKey: input.idempotencyKey,
        },
      });

  await logPaymentEvent({
    orderId: order.id,
    eventType: 'paypal_order_created',
    payload: paypalOrder,
  });

  return { order: serializeOrder(order), paypalOrderId: paypalOrder.id! };
}

export async function finalizeCapturedOrder(order: BookingPaymentOrder, capture: {
  captureId?: string;
  amountCents?: number | null;
  paymentMethod?: string;
  raw: unknown;
}) {
  if (order.status === 'paid' || order.status === 'testing_payment') {
    return serializeOrder(order);
  }

  const settings = await getPaymentGatewaySettings();
  if (capture.amountCents != null && Math.abs(capture.amountCents - order.amountCents) > 1) {
    await logPaymentEvent({
      orderId: order.id,
      eventType: 'amount_mismatch',
      payload: { expected: order.amountCents, received: capture.amountCents, raw: capture.raw },
      riskFlag: true,
      message: 'Captured amount did not match order total.',
    });
    await prisma.bookingPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'failed' },
    });
    throw new Error('Payment amount mismatch. Support has been notified.');
  }

  const status = settings.mode === 'sandbox' ? 'testing_payment' : 'paid';
  const updated = await prisma.bookingPaymentOrder.update({
    where: { id: order.id },
    data: {
      status,
      paypalCaptureId: capture.captureId ?? order.paypalCaptureId,
      paymentMethod: capture.paymentMethod ?? order.paymentMethod,
    },
  });

  if (order.couponId && order.status === 'pending_payment') {
    await prisma.coupon.update({
      where: { id: order.couponId },
      data: { redemptionCount: { increment: 1 } },
    });
  }

  await logPaymentEvent({
    orderId: order.id,
    eventType: status === 'testing_payment' ? 'payment_testing' : 'payment_paid',
    payload: capture.raw,
  });

  if (!updated.invoiceEmailedAt) {
    await sendBookingInvoiceEmails(updated);
    await prisma.bookingPaymentOrder.update({
      where: { id: updated.id },
      data: { invoiceEmailedAt: new Date() },
    });
  }

  return serializeOrder(updated);
}

export async function captureOnlineOrder(paypalOrderId: string) {
  const order = await prisma.bookingPaymentOrder.findUnique({ where: { paypalOrderId } });
  if (!order) throw new Error('Order not found for this PayPal payment.');

  if (order.status === 'paid' || order.status === 'testing_payment') {
    return serializeOrder(order);
  }

  const result = await capturePayPalOrder(paypalOrderId);
  await logPaymentEvent({
    orderId: order.id,
    eventType: 'paypal_capture_response',
    payload: { status: result.status, body: result.body },
    httpStatus: result.status,
  });

  if (result.status >= 300) {
    await prisma.bookingPaymentOrder.update({
      where: { id: order.id },
      data: { status: 'failed' },
    });
    throw new Error(`PayPal capture failed (${result.status}).`);
  }

  const capture = result.body.purchase_units?.[0]?.payments?.captures?.[0];
  const paymentMethod = result.body.payment_source?.venmo
    ? 'venmo'
    : result.body.payment_source?.paypal
      ? 'paypal'
      : 'paypal';

  return finalizeCapturedOrder(order, {
    captureId: capture?.id,
    amountCents: dollarsToCents(capture?.amount?.value),
    paymentMethod,
    raw: result.body,
  });
}

export async function getOrderByReference(reference: string) {
  const order = await prisma.bookingPaymentOrder.findUnique({ where: { reference } });
  return order ? serializeOrder(order) : null;
}

export async function listOrders(limit = 50) {
  const rows = await prisma.bookingPaymentOrder.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
  });
  return rows.map(serializeOrder);
}

export async function listOrderEvents(orderId: string) {
  return prisma.paymentEventLog.findMany({
    where: { orderId },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
}
