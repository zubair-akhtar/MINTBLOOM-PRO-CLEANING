// @polsia:user-owned — public booking catalog endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { getBookingOptions } from '@/lib/business/bookings';
import { BookingOptionsResponse } from '@/lib/contracts/bookings';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(BookingOptionsResponse.parse(getBookingOptions()));
}
