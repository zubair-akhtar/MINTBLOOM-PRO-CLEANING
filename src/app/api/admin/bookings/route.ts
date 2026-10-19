// @polsia:user-owned — admin-only consolidated owner bookings endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { getOwnerBookings } from '@/lib/business/owner-bookings';
import { OwnerBookingsQuery, OwnerBookingsResponse } from '@/lib/contracts/owner-bookings';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

async function authenticatedAdmin(request: Request): Promise<SessionUser | Response> {
  try {
    const user = await requireAuth(request);
    if (user.role !== 'admin') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }
    return user;
  } catch (response) {
    return response as Response;
  }
}

export async function GET(request: Request) {
  const admin = await authenticatedAdmin(request);
  if (admin instanceof Response) return admin;

  const searchParams = new URL(request.url).searchParams;
  const parsed = OwnerBookingsQuery.safeParse({
    range: searchParams.get('range') ?? undefined,
    service: searchParams.get('service') ?? undefined,
    status: searchParams.get('status') ?? undefined,
  });
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_query', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  try {
    return NextResponse.json(OwnerBookingsResponse.parse(await getOwnerBookings(parsed.data)));
  } catch {
    return NextResponse.json({ error: 'Could not load owner bookings' }, { status: 500 });
  }
}
