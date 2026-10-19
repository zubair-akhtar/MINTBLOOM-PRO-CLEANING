// @polsia:user-owned
//
// POST /api/contact — plain REST route handler that writes a ContactMessage and
// sends a best-effort notification to the company inbox.
// Lives under /api, which proxy.ts's matcher excludes (no CSP/nonce, not proxied).
// PUBLIC — no auth check.
//
// Requires the `email` module (send + templates).

import 'server-only';
import { NextResponse } from 'next/server';
import { contactSchema } from '@/lib/contact/schema';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { recordSubmission } from '@/lib/email/submissions';
import { notificationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

export const dynamic = 'force-dynamic';

export async function POST(req: Request) {
  const body = await req.json();
  const result = contactSchema.safeParse({
    name: body.name,
    email: body.email,
    message: body.message,
  });
  if (!result.success) {
    const fieldErrors = result.error.flatten().fieldErrors;
    return NextResponse.json(
      {
        errors: {
          name: fieldErrors.name?.[0],
          email: fieldErrors.email?.[0],
          message: fieldErrors.message?.[0],
        },
      },
      { status: 400 },
    );
  }

  try {
    const submission = await prisma.contactMessage.create({ data: result.data });
    await notifyCompany(result.data, submission.id);
  } catch {
    return NextResponse.json(
      { errors: { message: 'Something went wrong. Please try again.' } },
      { status: 500 },
    );
  }

  return NextResponse.json({ ok: true }, { status: 201 });
}

/**
 * The database row is the source of truth, so email is best-effort and a
 * delivery failure must never turn a captured request into an error for the
 * visitor. The sender's address stays in the message body because the email
 * proxy does not support a custom Reply-To address.
 */
async function notifyCompany(
  input: { name: string; email: string; message: string },
  submissionId: string,
) {
  try {
    const recorded = await recordSubmission({
      source: 'contact_form',
      email: input.email,
      name: input.name,
      message: input.message,
      idempotencyKey: submissionId,
    });
    if (recorded.recorded) return;
  } catch {
    // Fall through to the company-inbox email when dashboard recording is unavailable.
  }

  if (!env.POLSIA_COMPANY_EMAIL) return;

  try {
    await sendEmail({
      to: env.POLSIA_COMPANY_EMAIL,
      ...notificationEmail({
        subject: `New contact message from ${input.name}`,
        title: 'New contact message',
        lines: [`From: ${input.name} <${input.email}>`, input.message],
      }),
    });
  } catch {
    // Deliberately swallowed — see the best-effort note above.
  }
}
