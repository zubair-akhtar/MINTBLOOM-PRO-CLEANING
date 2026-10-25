// @polsia:user-owned — public active rate-card summary for /book service hints.
import 'server-only';

import { NextResponse } from 'next/server';
import { getActivePricingSettings } from '@/lib/business/pricing/store';
import type { PricedServiceId } from '@/lib/business/pricing/types';

export const dynamic = 'force-dynamic';

const PRICED: PricedServiceId[] = ['standard', 'deep', 'move', 'airbnb'];

export async function GET() {
  try {
    const { version, label, settings } = await getActivePricingSettings();
    const services = Object.fromEntries(
      PRICED.map((id) => [
        id,
        {
          baseCents: settings.services[id].baseCents,
          minimumCents: settings.services[id].minimumCents,
          areaRateCentsPerSqFt: settings.services[id].areaRateCentsPerSqFt,
          bedroomCents: settings.services[id].bedroomCents,
          bathCents: settings.services[id].bathCents,
        },
      ]),
    );

    return NextResponse.json(
      {
        version,
        label,
        includedSqFt: settings.includedSqFt,
        commercialPerSqFtCents: settings.commercialPerSqFtCents,
        services,
      },
      {
        headers: {
          'Cache-Control': 'no-store, max-age=0',
        },
      },
    );
  } catch (error) {
    console.error('[pricing/rate-card]', error);
    return NextResponse.json({ error: 'rate_card_unavailable' }, { status: 500 });
  }
}
