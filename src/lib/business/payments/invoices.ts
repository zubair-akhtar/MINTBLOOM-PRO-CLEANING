// @polsia:user-owned — quote + invoice email notifications.
import 'server-only';

import type { BookingPaymentOrder } from '@prisma/client';
import { sendEmail } from '@/lib/email/send';
import { env } from '@/lib/env';

function money(cents: number) {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}

function linesFromSnapshot(snapshot: unknown) {
  if (!snapshot || typeof snapshot !== 'object') return [] as Array<{ label: string; amount: string }>;
  const record = snapshot as Record<string, unknown>;
  const lines = Array.isArray(record.lines) ? record.lines : [];
  return lines
    .map((line) => {
      if (!line || typeof line !== 'object') return null;
      const item = line as Record<string, unknown>;
      const label = typeof item.label === 'string' ? item.label : 'Line item';
      const amountCents =
        typeof item.amountCents === 'number'
          ? item.amountCents
          : typeof item.amount === 'number'
            ? item.amount
            : null;
      if (amountCents == null) return { label, amount: '' };
      return { label, amount: money(amountCents) };
    })
    .filter(Boolean) as Array<{ label: string; amount: string }>;
}

export async function sendQuoteAdminEmail(order: BookingPaymentOrder) {
  const to = env.POLSIA_OWNER_EMAIL;
  if (!to) return;
  const text = [
    `New quote request ${order.reference}`,
    `Name: ${order.fullName}`,
    `Email: ${order.email}`,
    `Phone: ${order.phone}`,
    `Service: ${order.serviceId}`,
    `Address: ${order.addressLine1}, ${order.city}, ${order.state} ${order.zip}`,
    `Preferred date: ${order.preferredDate ? order.preferredDate.toISOString().slice(0, 10) : 'n/a'}`,
    `Notes: ${order.notes || 'n/a'}`,
    `Subtotal: ${money(order.subtotalCents)}`,
    `Discount: ${money(order.discountCents)}`,
    `Tax: ${money(order.taxCents)}`,
    `Total: ${money(order.amountCents)}`,
    `Coupon: ${order.couponCode || 'none'}`,
  ].join('\n');

  await sendEmail({
    to,
    subject: `New quote request ${order.reference}`,
    html: `<pre style="font-family:ui-monospace,monospace;white-space:pre-wrap">${text}</pre>`,
    text,
  });
}

export async function sendBookingInvoiceEmails(order: BookingPaymentOrder) {
  const statusLabel =
    order.status === 'testing_payment' ? 'Testing payment (sandbox)' : 'Paid';
  const lineRows = linesFromSnapshot(order.estimateSnapshot)
    .map((line) => `<tr><td style="padding:6px 0">${line.label}</td><td style="text-align:right">${line.amount}</td></tr>`)
    .join('');

  const html = `
  <div style="font-family:Georgia,serif;color:#14261c;max-width:560px;margin:0 auto">
    <h1 style="font-size:24px;margin:0 0 8px">Mintbloomproclean invoice</h1>
    <p style="margin:0 0 16px;color:#4b6354">Reference ${order.reference} · ${statusLabel}</p>
    <p><strong>${order.fullName}</strong><br/>${order.email}<br/>${order.phone}</p>
    <p>${order.addressLine1}${order.addressLine2 ? `, ${order.addressLine2}` : ''}<br/>${order.city}, ${order.state} ${order.zip}</p>
    <p>Preferred date: ${order.preferredDate ? order.preferredDate.toISOString().slice(0, 10) : 'n/a'}<br/>
    Payment method: ${order.paymentMethod || 'paypal'}<br/>
    Service: ${order.serviceId}</p>
    <table style="width:100%;border-collapse:collapse;margin:16px 0">${lineRows}</table>
    <p>Subtotal: ${money(order.subtotalCents)}<br/>
    Discount: ${money(order.discountCents)}${order.couponCode ? ` (${order.couponCode})` : ''}<br/>
    Tax: ${money(order.taxCents)}<br/>
    <strong>Total: ${money(order.amountCents)}</strong></p>
    <p style="color:#4b6354;font-size:14px">Thank you for choosing Mintbloomproclean. Questions? Reply to this email or call (806) 581-1100.</p>
  </div>`;

  const text = `Mintbloomproclean invoice ${order.reference} (${statusLabel})\nTotal ${money(order.amountCents)}\n${order.fullName} · ${order.email}`;

  await sendEmail({
    to: order.email,
    subject: `Your Mintbloom invoice ${order.reference}`,
    html,
    text,
  });

  if (env.POLSIA_OWNER_EMAIL) {
    await sendEmail({
      to: env.POLSIA_OWNER_EMAIL,
      subject: `Paid booking ${order.reference} (${statusLabel})`,
      html,
      text,
    });
  }
}
