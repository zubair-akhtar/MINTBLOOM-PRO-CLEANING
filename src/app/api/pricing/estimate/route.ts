// @polsia:user-owned — quote-only estimate calculator endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { calculateEstimate } from '@/lib/business/pricing/calculate';
import { getActivePricingSettings } from '@/lib/business/pricing/store';
import { estimateInputSchema, estimateResponseSchema } from '@/lib/contracts/pricing';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers });

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }
  const parsed = estimateInputSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  try {
    const { version, settings } = await getActivePricingSettings();
    const result = estimateResponseSchema.parse(calculateEstimate(version, settings, parsed.data));
    return NextResponse.json(result, { headers });
  } catch {
    return NextResponse.json({ error: 'estimate_unavailable' }, { status: 503, headers });
  }
}
