// @polsia:user-owned — public order lookup by reference (confirmation page).
import { NextResponse } from 'next/server';
import { getOrderByReference } from '@/lib/business/payments/orders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const ref = new URL(request.url).searchParams.get('ref');
  if (!ref)
    return NextResponse.json({ error: 'missing_ref' }, { status: 400, headers: { 'Cache-Control': 'no-store' } });
  const order = await getOrderByReference(ref);
  if (!order)
    return NextResponse.json({ error: 'not_found' }, { status: 404, headers: { 'Cache-Control': 'no-store' } });
  return NextResponse.json({ order }, { headers: { 'Cache-Control': 'no-store' } });
}
