// @polsia:user-owned — load/save active pricing rate card and market tax.

import 'server-only';

import { DEFAULT_PRICING_SETTINGS, LAUNCH_PRICING_LABEL } from '@/lib/business/pricing/defaults';
import type { PricingSettings } from '@/lib/business/pricing/types';
import { prisma } from '@/lib/db';

function parseSettings(value: unknown): PricingSettings {
  // Trust admin-saved JSON shape; merge onto defaults for forward-compat keys.
  const raw = value && typeof value === 'object' ? (value as Partial<PricingSettings>) : {};
  return {
    ...DEFAULT_PRICING_SETTINGS,
    ...raw,
    schemaVersion: 1,
    services: {
      ...DEFAULT_PRICING_SETTINGS.services,
      ...(raw.services ?? {}),
    },
    recurringDiscounts: {
      ...DEFAULT_PRICING_SETTINGS.recurringDiscounts,
      ...(raw.recurringDiscounts ?? {}),
    },
    travelBands: raw.travelBands?.length ? raw.travelBands : DEFAULT_PRICING_SETTINGS.travelBands,
    addOns: raw.addOns?.length ? raw.addOns : DEFAULT_PRICING_SETTINGS.addOns,
  };
}

export async function ensureActiveRateCard() {
  try {
    const active = await prisma.pricingRateCard.findFirst({
      where: { isActive: true },
      orderBy: { version: 'desc' },
    });
    if (active) {
      return { ...active, settings: parseSettings(active.settings) };
    }

    const created = await prisma.pricingRateCard.create({
      data: {
        version: 1,
        label: LAUNCH_PRICING_LABEL,
        isActive: true,
        settings: DEFAULT_PRICING_SETTINGS as object,
      },
    });
    return { ...created, settings: parseSettings(created.settings) };
  } catch {
    // DB / table unavailable — serve launch defaults so the calculator still works.
    return {
      id: 'defaults',
      version: 1,
      label: LAUNCH_PRICING_LABEL,
      isActive: true,
      settings: DEFAULT_PRICING_SETTINGS,
      createdAt: new Date(0),
      updatedAt: new Date(0),
    };
  }
}

export async function getActivePricingSettings(): Promise<{
  version: number;
  label: string;
  settings: PricingSettings;
}> {
  const card = await ensureActiveRateCard();
  return { version: card.version, label: card.label, settings: card.settings };
}

export async function saveNewRateCardVersion(input: {
  label?: string;
  settings: PricingSettings;
}): Promise<{ version: number }> {
  const latest = await prisma.pricingRateCard.findFirst({ orderBy: { version: 'desc' } });
  const nextVersion = (latest?.version ?? 0) + 1;

  await prisma.$transaction(async (tx) => {
    await tx.pricingRateCard.updateMany({
      where: { isActive: true },
      data: { isActive: false },
    });
    await tx.pricingRateCard.create({
      data: {
        version: nextVersion,
        label: input.label?.trim() || `Pricing v${nextVersion}`,
        isActive: true,
        settings: input.settings as object,
      },
    });
  });

  return { version: nextVersion };
}

/** Launch fallback when city is blank or market row is missing (keeps live estimates working). */
const LAUNCH_ESTIMATE_FALLBACK = {
  id: 'launch-fallback',
  name: 'Lubbock',
  city: 'Lubbock',
  state: 'TX',
  isActive: true,
  pricingEnabled: true,
  combinedTaxRateBps: 825,
  createdAt: new Date(0),
  updatedAt: new Date(0),
};

export async function resolveMarketForEstimate(city: string, state: string) {
  const normalizedCity = city.trim() || 'Lubbock';
  const normalizedState = (state.trim() || 'TX').toUpperCase();
  try {
    const market = await prisma.serviceMarket.findFirst({
      where: {
        city: { equals: normalizedCity, mode: 'insensitive' },
        state: { equals: normalizedState, mode: 'insensitive' },
        isActive: true,
      },
    });
    if (market) return market;

    // Prefer Lubbock launch market when the typed city is not configured yet.
    const launch = await prisma.serviceMarket.findFirst({
      where: {
        city: { equals: 'Lubbock', mode: 'insensitive' },
        state: { equals: 'TX', mode: 'insensitive' },
        isActive: true,
        pricingEnabled: true,
      },
    });
    if (launch) return launch;
  } catch {
    // Tables missing / DB unavailable — still return a priced preview.
  }
  return { ...LAUNCH_ESTIMATE_FALLBACK };
}

export async function listMarketsForAdmin() {
  return prisma.serviceMarket.findMany({
    orderBy: [{ state: 'asc' }, { city: 'asc' }],
  });
}

export async function updateMarketTax(input: {
  id: string;
  combinedTaxRateBps: number | null;
  pricingEnabled: boolean;
  isActive: boolean;
}) {
  return prisma.serviceMarket.update({
    where: { id: input.id },
    data: {
      combinedTaxRateBps: input.combinedTaxRateBps,
      pricingEnabled: input.pricingEnabled,
      isActive: input.isActive,
    },
  });
}
