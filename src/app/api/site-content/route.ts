// @polsia:user-owned — typed public homepage content endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { getSiteContent } from '@/lib/business/site-content';
import { SiteContentResponse } from '@/lib/contracts/site-content';

export const dynamic = 'force-dynamic';

export async function GET() {
  return NextResponse.json(SiteContentResponse.parse(getSiteContent()));
}
