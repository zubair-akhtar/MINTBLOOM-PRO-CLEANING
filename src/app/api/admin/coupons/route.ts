// @polsia:user-owned — admin coupon list/create.
import { NextResponse } from 'next/server';
import { noStore, requireAdminUser } from '@/lib/business/payments/admin-auth';
import { createCoupon, listCoupons } from '@/lib/business/payments/coupons';
import { saveCouponSchema } from '@/lib/contracts/payments';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ coupons: await listCoupons() }, { headers: noStore });
}

export async function POST(request: Request) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: noStore });
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers: noStore });
  }
  const parsed = saveCouponSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers: noStore });

  try {
    const coupon = await createCoupon(parsed.data);
    return NextResponse.json({ coupon }, { status: 201, headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'create_failed';
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}
