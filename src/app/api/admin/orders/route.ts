// @polsia:user-owned — admin booking payment orders list.
import { NextResponse } from 'next/server';
import { noStore, requireAdminUser } from '@/lib/business/payments/admin-auth';
import { listOrders } from '@/lib/business/payments/orders';

export const dynamic = 'force-dynamic';

export async function GET(request: Request) {
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  return NextResponse.json({ orders: await listOrders(100) }, { headers: noStore });
}
