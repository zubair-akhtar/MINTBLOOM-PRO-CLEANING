// @polsia:user-owned — quote-only booking request (no payment).
import { NextResponse } from 'next/server';
import { createQuoteOrder } from '@/lib/business/payments/orders';
import { createQuoteRequestSchema } from '@/lib/contracts/payments';
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

  const parsed = createQuoteRequestSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  try {
    const order = await createQuoteOrder(parsed.data);
    return NextResponse.json({ ok: true, order }, { status: 201, headers });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'quote_failed';
    return NextResponse.json({ error: message }, { status: 400, headers });
  }
}
