// @polsia:user-owned — payment event logs for one order.
import { NextResponse } from 'next/server';
import { noStore, requireAdminUser } from '@/lib/business/payments/admin-auth';
import { listOrderEvents } from '@/lib/business/payments/orders';

export const dynamic = 'force-dynamic';

export async function GET(
  request: Request,
  context: { params: Promise<{ id: string }> },
) {
  const user = await requireAdminUser(request);
  if (user instanceof NextResponse) return user;
  const { id } = await context.params;
  const events = await listOrderEvents(id);
  return NextResponse.json(
    {
      events: events.map((event) => ({
        id: event.id,
        eventType: event.eventType,
        httpStatus: event.httpStatus,
        riskFlag: event.riskFlag,
        message: event.message,
        createdAt: event.createdAt.toISOString(),
      })),
    },
    { headers: noStore },
  );
}
