// @polsia:user-owned — admin rate-card + market tax settings.
import 'server-only';

import { NextResponse } from 'next/server';
import { DEFAULT_PRICING_SETTINGS } from '@/lib/business/pricing/defaults';
import type { PricingSettings } from '@/lib/business/pricing/types';
import {
  getActivePricingSettings,
  listMarketsForAdmin,
  saveNewRateCardVersion,
  updateMarketTax,
} from '@/lib/business/pricing/store';
import {
  AdminPricingSettingsPut,
  AdminPricingSettingsResponse,
} from '@/lib/contracts/pricing';
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

  const [{ version, label, settings }, markets] = await Promise.all([
    getActivePricingSettings(),
    listMarketsForAdmin(),
  ]);

  return NextResponse.json(
    AdminPricingSettingsResponse.parse({
      version,
      label,
      settings,
      markets: markets.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        state: m.state,
        isActive: m.isActive,
        pricingEnabled: m.pricingEnabled,
        combinedTaxRateBps: m.combinedTaxRateBps,
      })),
    }),
    { headers: { 'Cache-Control': 'no-store, max-age=0' } },
  );
}

export async function PUT(request: Request) {
  const admin = await authenticatedAdmin(request);
  if (admin instanceof Response) return admin;

  let body: unknown;
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'invalid_json' }, { status: 400 });
  }

  const parsed = AdminPricingSettingsPut.safeParse(body);
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'invalid_body', errors: parsed.error.flatten().fieldErrors },
      { status: 400 },
    );
  }

  const incoming = parsed.data.settings as Partial<PricingSettings>;
  const incomingServices = (incoming.services ?? {}) as Partial<PricingSettings['services']>;
  const merged: PricingSettings = {
    ...DEFAULT_PRICING_SETTINGS,
    ...incoming,
    schemaVersion: 1,
    services: {
      standard: {
        ...DEFAULT_PRICING_SETTINGS.services.standard,
        ...incomingServices.standard,
      },
      deep: { ...DEFAULT_PRICING_SETTINGS.services.deep, ...incomingServices.deep },
      move: { ...DEFAULT_PRICING_SETTINGS.services.move, ...incomingServices.move },
      airbnb: { ...DEFAULT_PRICING_SETTINGS.services.airbnb, ...incomingServices.airbnb },
    },
    recurringDiscounts: {
      ...DEFAULT_PRICING_SETTINGS.recurringDiscounts,
      ...(incoming.recurringDiscounts ?? {}),
    },
  };

  const { version } = await saveNewRateCardVersion({
    label: parsed.data.label,
    settings: merged,
  });

  if (parsed.data.markets) {
    for (const market of parsed.data.markets) {
      await updateMarketTax(market);
    }
  }

  const [{ label, settings }, markets] = await Promise.all([
    getActivePricingSettings(),
    listMarketsForAdmin(),
  ]);

  return NextResponse.json(
    AdminPricingSettingsResponse.parse({
      version,
      label,
      settings,
      markets: markets.map((m) => ({
        id: m.id,
        name: m.name,
        city: m.city,
        state: m.state,
        isActive: m.isActive,
        pricingEnabled: m.pricingEnabled,
        combinedTaxRateBps: m.combinedTaxRateBps,
      })),
    }),
  );
}
