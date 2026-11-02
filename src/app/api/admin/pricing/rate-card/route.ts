// @polsia:user-owned — admin-only rate-card read and versioned save.
import 'server-only';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';
import {
  adminRateCardResponse,
  getActivePricingSettings,
  RateCardConflictError,
  savePricingSettings,
} from '@/lib/business/pricing/store';
import { rateCardAdminResponseSchema, saveRateCardSchema } from '@/lib/contracts/pricing';
import { sameOrigin } from '@/lib/same-origin';

export const dynamic = 'force-dynamic';

async function authorize(request: Request) {
  const user = (await auth.api.getSession({ headers: request.headers }))?.user;
  const noStore = { 'Cache-Control': 'no-store' };
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers: noStore });
  if (user.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers: noStore });
  return user;
}

export async function GET(request: Request) {
  const user = await authorize(request);
  if (user instanceof NextResponse) return user;
  try {
    const result = rateCardAdminResponseSchema.parse(
      adminRateCardResponse(await getActivePricingSettings()),
    );
    return NextResponse.json(result, { headers: { 'Cache-Control': 'no-store' } });
  } catch {
    return NextResponse.json(
      { error: 'rate_card_unavailable' },
      { status: 503, headers: { 'Cache-Control': 'no-store' } },
    );
  }
}

export async function POST(request: Request) {
  const headers = { 'Cache-Control': 'no-store' };
  if (!sameOrigin(request))
    return NextResponse.json({ error: 'forbidden_origin' }, { status: 403, headers });
  const user = await authorize(request);
  if (user instanceof NextResponse) return user;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400, headers });
  }
  const parsed = saveRateCardSchema.safeParse(body);
  if (!parsed.success)
    return NextResponse.json({ errors: parsed.error.flatten() }, { status: 400, headers });

  try {
    const record = await savePricingSettings(
      parsed.data.expectedVersion,
      parsed.data.settings,
      user.id,
    );
    return NextResponse.json(
      rateCardAdminResponseSchema.parse({
        version: record.version,
        updatedAt: record.createdAt.toISOString(),
        settings: record.settings,
      }),
      { status: 201, headers },
    );
  } catch (error) {
    if (error instanceof RateCardConflictError)
      return NextResponse.json({ error: 'version_conflict' }, { status: 409, headers });
    return NextResponse.json({ error: 'rate_card_save_failed' }, { status: 500, headers });
  }
}
