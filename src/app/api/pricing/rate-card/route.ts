// @polsia:user-owned — public, customer-safe active rate-card hints.
import 'server-only';

import { NextResponse } from 'next/server';
import { formatUsdFromCents } from '@/lib/business/pricing/money';
import { getActivePricingSettings } from '@/lib/business/pricing/store';
import { publicRateCardSchema } from '@/lib/contracts/pricing';

export const dynamic = 'force-dynamic';

export async function GET() {
  try {
    const { version, settings } = await getActivePricingSettings();
    const response = publicRateCardSchema.parse({
      version,
      includedSqFt: settings.includedSqFt,
      serviceHints: {
        standard: `From ${formatUsdFromCents(settings.services.standard.baseCents)}`,
        deep: `From ${formatUsdFromCents(settings.services.deep.baseCents)}`,
        move: `From ${formatUsdFromCents(settings.services.move.baseCents)}`,
        airbnb: `From ${formatUsdFromCents(settings.services.airbnb.baseCents)}`,
        commercial: 'Walkthrough',
        postConstruction: 'Quote',
        medicalGradeSanitation: 'Quote',
      },
    });
    return NextResponse.json(response, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'rate_card_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}
