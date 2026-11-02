// @polsia:user-owned — admin coupon update/delete.
import { NextResponse } from 'next/server';
import { noStore, requireAdminUser } from '@/lib/business/payments/admin-auth';
import { deleteCoupon, updateCoupon } from '@/lib/business/payments/coupons';
import { saveCouponSchema } from '@/lib/contracts/payments';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function PUT(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: noStore });
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;

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
    const coupon = await updateCoupon(id, parsed.data);
    return NextResponse.json({ coupon }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'update_failed';
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}

export async function DELETE(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers: noStore });
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  try {
    await deleteCoupon(id);
    return NextResponse.json({ ok: true }, { headers: noStore });
  } catch (error) {
    const message = error instanceof Error ? error.message : 'delete_failed';
    return NextResponse.json({ error: message }, { status: 400, headers: noStore });
  }
}
