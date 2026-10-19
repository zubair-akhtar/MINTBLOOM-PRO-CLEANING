// @polsia:user-owned — public estimate endpoint (no payment).
import 'server-only';

import { NextResponse } from 'next/server';
import { calculateEstimate } from '@/lib/business/pricing/calculate';
import { getActivePricingSettings, resolveMarketForEstimate } from '@/lib/business/pricing/store';
import { EstimateRequest, EstimateResponse } from '@/lib/contracts/pricing';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = EstimateRequest.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const input = parsed.data;
  try {
    const [{ version, settings }, market] = await Promise.all([
      getActivePricingSettings(),
      resolveMarketForEstimate(input.city, input.state),
    ]);

    const result = calculateEstimate(
      {
        service: input.service,
        squareFeet: input.squareFeet,
        bedrooms: input.bedrooms,
        fullBaths: input.fullBaths,
        halfBaths: input.halfBaths,
        offices: input.offices,
        extraLivingRooms: input.extraLivingRooms,
        kitchens: input.kitchens,
        cadence: input.cadence,
        isFirstRecurringVisit: input.isFirstRecurringVisit,
        addOnQuantities: input.addOnQuantities,
        heavyConditionApproved: input.heavyConditionApproved,
        petHairNeeded: input.petHairNeeded,
        rushRequested: input.rushRequested,
        travelMiles: input.travelMiles,
        highWorkRequested: input.highWorkRequested,
        severeOrUnknownCondition: input.severeOrUnknownCondition,
        marketPricingEnabled: market.pricingEnabled === true,
        taxRateBps: market.combinedTaxRateBps ?? 825,
      },
      settings,
    );

    const payload = EstimateResponse.parse({
      ...result,
      rateCardVersion: version,
      market: {
        id: market.id,
        name: market.name,
        city: market.city,
        state: market.state,
        pricingEnabled: market.pricingEnabled,
      },
      commercialReferenceCents:
        input.service === 'commercial' && input.squareFeet
          ? Math.round(input.squareFeet * settings.commercialPerSqFtCents)
          : undefined,
    });

    return NextResponse.json(payload);
  } catch (error) {
    console.error('[pricing/estimate]', error);
    return NextResponse.json({ error: 'estimate_failed' }, { status: 500 });
  }
}
