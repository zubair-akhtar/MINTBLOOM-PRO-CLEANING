// @polsia:user-owned — public coupon validation.
import { NextResponse } from 'next/server';
import { findValidCoupon } from '@/lib/business/payments/coupons';
import { validateCouponResultSchema, validateCouponSchema } from '@/lib/contracts/payments';
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

  const parsed = validateCouponSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  const result = await findValidCoupon(
    parsed.data.code,
    parsed.data.channel,
    parsed.data.subtotalCents,
  );

  if (!result.valid) {
    return NextResponse.json(
      validateCouponResultSchema.parse({ valid: false, error: result.error }),
      { headers },
    );
  }

  return NextResponse.json(
    validateCouponResultSchema.parse({
      valid: true,
      code: result.code,
      name: result.name,
      discountCents: result.discountCents,
    }),
    { headers },
  );
}
