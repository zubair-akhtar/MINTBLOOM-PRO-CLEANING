// @polsia:user-owned — public read endpoint for posted careers openings and markets.
import 'server-only';

import { NextResponse } from 'next/server';
import { CareersResponse } from '@/lib/contracts/careers';
import { prisma } from '@/lib/db';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const [openings, markets] = await Promise.all([
      prisma.jobOpening.findMany({
        where: {
          status: 'published',
          closedAt: null,
          market: { isActive: true },
        },
        select: {
          id: true,
          title: true,
          role: true,
          employmentArea: true,
          state: true,
          city: true,
          marketId: true,
          schedule: true,
          requirements: true,
          compensation: true,
          publishedAt: true,
        },
        orderBy: [{ publishedAt: 'desc' }, { createdAt: 'desc' }],
      }),
      prisma.serviceMarket.findMany({
        where: { isActive: true },
        select: { id: true, name: true, state: true, city: true },
        orderBy: [{ state: 'asc' }, { city: 'asc' }],
      }),
    ]);

    const payload = CareersResponse.parse({
      openings: openings.map((opening) => ({
        ...opening,
        publishedAt: opening.publishedAt?.toISOString() ?? new Date(0).toISOString(),
      })),
      markets,
    });
    return NextResponse.json(payload);
  } catch {
    return NextResponse.json({ error: 'Could not load careers information' }, { status: 500 });
  }
}
