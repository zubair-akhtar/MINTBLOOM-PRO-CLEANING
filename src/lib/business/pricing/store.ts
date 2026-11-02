// @polsia:user-owned — server-side active rate-card persistence.
import 'server-only';

import type { Prisma } from '@prisma/client';
import type { z } from 'zod';
import { defaultPricingSettings } from '@/lib/business/pricing/defaults';
import {
  type PricingSettings,
  pricingSettingsSchema,
  type rateCardAdminResponseSchema,
} from '@/lib/contracts/pricing';
import { prisma } from '@/lib/db';

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function parseStoredSettings(value: Prisma.JsonValue): PricingSettings {
  const raw = isRecord(value) ? value : {};
  const rawMarkets: unknown[] = Array.isArray(raw.markets)
    ? raw.markets
    : defaultPricingSettings.markets;
  const markets: unknown[] = rawMarkets.map((market) => {
    if (!isRecord(market)) return market;
    const fallback = defaultPricingSettings.markets.find(
      (candidate) =>
        candidate.id === market.id ||
        (typeof market.city === 'string' &&
          typeof market.state === 'string' &&
          candidate.city.toLocaleLowerCase('en-US') ===
            market.city.trim().toLocaleLowerCase('en-US') &&
          candidate.state === market.state.toUpperCase()),
    );
    return {
      ...market,
      taxBasisPoints:
        typeof market.taxBasisPoints === 'number' || market.taxBasisPoints === null
          ? market.taxBasisPoints
          : (fallback?.taxBasisPoints ?? null),
      pricingEnabled:
        typeof market.pricingEnabled === 'boolean'
          ? market.pricingEnabled
          : (fallback?.pricingEnabled ?? true),
      isActive:
        typeof market.isActive === 'boolean' ? market.isActive : (fallback?.isActive ?? true),
    };
  });
  const locations = new Set(
    markets.flatMap((market) =>
      isRecord(market) && typeof market.city === 'string' && typeof market.state === 'string'
        ? [`${market.city.trim().toLocaleLowerCase('en-US')}|${market.state.toUpperCase()}`]
        : [],
    ),
  );
  for (const defaultMarket of defaultPricingSettings.markets) {
    const location = `${defaultMarket.city.toLocaleLowerCase('en-US')}|${defaultMarket.state}`;
    if (!locations.has(location)) markets.push(defaultMarket);
  }

  return pricingSettingsSchema.parse({
    ...defaultPricingSettings,
    ...raw,
    includedSqFt: raw.includedSqFt ?? defaultPricingSettings.includedSqFt,
    maxAutoSqFt: raw.maxAutoSqFt ?? defaultPricingSettings.maxAutoSqFt,
    markets,
  });
}

export class RateCardConflictError extends Error {
  constructor() {
    super(
      'The rate card changed while you were editing. Reload the current version and try again.',
    );
  }
}

export async function getActivePricingSettings() {
  await prisma.pricingRateCardVersion.createMany({
    data: [{ version: 1, settings: defaultPricingSettings as Prisma.InputJsonValue }],
    skipDuplicates: true,
  });
  const record = await prisma.pricingRateCardVersion.findFirst({ orderBy: { version: 'desc' } });
  if (!record) throw new Error('The pricing rate card is unavailable.');
  return {
    version: record.version,
    createdAt: record.createdAt,
    settings: parseStoredSettings(record.settings),
  };
}

export async function savePricingSettings(
  expectedVersion: number,
  settings: PricingSettings,
  userId: string,
) {
  const parsedSettings = pricingSettingsSchema.parse(settings);
  try {
    return await prisma.$transaction(async (tx) => {
      await tx.pricingRateCardVersion.createMany({
        data: [{ version: 1, settings: defaultPricingSettings as Prisma.InputJsonValue }],
        skipDuplicates: true,
      });
      const current = await tx.pricingRateCardVersion.findFirst({ orderBy: { version: 'desc' } });
      if (!current || current.version !== expectedVersion) throw new RateCardConflictError();
      return tx.pricingRateCardVersion.create({
        data: {
          version: current.version + 1,
          settings: parsedSettings as Prisma.InputJsonValue,
          createdByUserId: userId,
        },
      });
    });
  } catch (error) {
    if (error instanceof RateCardConflictError) throw error;
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      (error.code === 'P2002' || error.code === 'P2034')
    )
      throw new RateCardConflictError();
    throw error;
  }
}

export function adminRateCardResponse(
  record: Awaited<ReturnType<typeof getActivePricingSettings>>,
) {
  return {
    version: record.version,
    updatedAt: record.createdAt.toISOString(),
    settings: record.settings,
  } satisfies z.infer<typeof rateCardAdminResponseSchema>;
}
