// @polsia:user-owned — shared calculator and rate-card contracts.
import { z } from 'zod';

const cents = z.number().int().min(0).max(100_000_000);
const integerCount = z.number().int().min(0).max(100_000);

export const pricedServiceIds = ['standard', 'deep', 'move', 'airbnb'] as const;
export const publicServiceIds = [
  ...pricedServiceIds,
  'commercial',
  'postConstruction',
  'medicalGradeSanitation',
] as const;

const serviceRateSchema = z.object({
  baseCents: cents,
  minimumCents: cents,
});

const perServiceValues = () =>
  z.object({
    standard: cents,
    deep: cents,
    move: cents,
    airbnb: cents,
  });

export const marketTaxSchema = z.object({
  id: z.string().min(1).max(80),
  label: z.string().min(1).max(120),
  city: z.string().min(1).max(100),
  state: z.string().length(2),
  taxBasisPoints: z.number().int().min(0).max(20_000).nullable(),
  pricingEnabled: z.boolean(),
  isActive: z.boolean(),
});

export const pricingSettingsSchema = z
  .object({
    services: z.object({
      standard: serviceRateSchema,
      deep: serviceRateSchema,
      move: serviceRateSchema,
      airbnb: serviceRateSchema,
    }),
    includedSqFt: z.number().int().min(1).max(100_000),
    maxAutoSqFt: z.number().int().min(1).max(100_000),
    commercialReferenceCentsPerSqFt: cents,
    areaCentsPerSqFt: perServiceValues(),
    bedroomCents: perServiceValues(),
    bathEquivalentCents: perServiceValues(),
    officeCents: perServiceValues(),
    extraRoomCents: perServiceValues(),
    addOns: z.object({
      ovenCents: cents,
      refrigeratorCents: cents,
      cabinetBaseCents: cents,
      cabinetIncludedDoors: integerCount,
      cabinetExtraDoorCents: cents,
      windowPaneCents: cents,
      windowMinimumCents: cents,
      windowTrackCents: cents,
      blindCents: cents,
      baseboardsPerStarted1000Cents: cents,
      linenCents: cents,
      airbnbIncludedLinenBeds: integerCount,
      airbnbExtraLinenCents: cents,
      laundryPerLoadCents: cents,
      dishesPerBlockCents: cents,
      garageBayCents: cents,
      petHairCents: cents,
      rushCents: cents,
      heavyConditionBasisPoints: z.number().int().min(0).max(20_000),
    }),
    recurringDiscountBasisPoints: z.object({
      weekly: z.number().int().min(0).max(10_000),
      biweekly: z.number().int().min(0).max(10_000),
      monthly: z.number().int().min(0).max(10_000),
    }),
    markets: z.array(marketTaxSchema).min(1).max(50),
  })
  .strict()
  .superRefine((settings, ctx) => {
    if (settings.maxAutoSqFt < settings.includedSqFt)
      ctx.addIssue({
        code: 'custom',
        path: ['maxAutoSqFt'],
        message: 'Maximum automatic size must include the base square footage.',
      });
    const ids = settings.markets.map((market) => market.id);
    const locations = settings.markets.map(
      (market) => `${market.city.trim().toLocaleLowerCase('en-US')}|${market.state.toUpperCase()}`,
    );
    if (new Set(ids).size !== ids.length)
      ctx.addIssue({ code: 'custom', path: ['markets'], message: 'Market IDs must be unique.' });
    if (new Set(locations).size !== locations.length)
      ctx.addIssue({
        code: 'custom',
        path: ['markets'],
        message: 'Each city and state may appear only once.',
      });
  });

export const estimateInputSchema = z
  .object({
    service: z.enum(publicServiceIds),
    squareFeet: z.number().int().min(1).max(100_000),
    bedrooms: z.number().int().min(0).max(20),
    fullBaths: z.number().int().min(0).max(20),
    halfBaths: z.number().int().min(0).max(20),
    kitchens: z.number().int().min(1).max(20),
    offices: z.number().int().min(0).max(20),
    extraRooms: z.number().int().min(0).max(20),
    condition: z.enum(['routine', 'heavy', 'severe', 'unknown']),
    highWork: z.boolean(),
    heavyConditionApproved: z.boolean(),
    cadence: z.enum(['weekly', 'biweekly', 'monthly']).nullable(),
    returningRecurring: z.boolean(),
    ovenCavities: z.number().int().min(0).max(10),
    refrigeratorCount: z.number().int().min(0).max(10),
    cabinetDoors: z.number().int().min(0).max(500),
    baseboards: z.boolean(),
    windowPanes: z.number().int().min(0).max(500),
    windowTracks: z.number().int().min(0).max(500),
    blinds: z.number().int().min(0).max(500),
    linenBeds: z.number().int().min(0).max(50),
    laundryLoads: z.number().int().min(0).max(2),
    dishBlocks: z.number().int().min(0).max(2),
    garageBays: z.number().int().min(0).max(10),
    petHair: z.boolean(),
    rush: z.boolean(),
    travelMiles: z.number().int().min(0).max(10_000),
    city: z.string().trim().min(1).max(100),
    state: z.string().trim().length(2),
  })
  .strict()
  .superRefine((input, ctx) => {
    if (input.service !== 'standard' && input.cadence !== null)
      ctx.addIssue({
        code: 'custom',
        path: ['cadence'],
        message: 'Frequency is available only for Standard.',
      });
  });

export const publicRateCardSchema = z.object({
  version: z.number().int().positive(),
  includedSqFt: z.number().int().positive(),
  serviceHints: z.object({
    standard: z.string(),
    deep: z.string(),
    move: z.string(),
    airbnb: z.string(),
    commercial: z.string(),
    postConstruction: z.string(),
    medicalGradeSanitation: z.string().optional(),
  }),
});

export const rateCardAdminResponseSchema = z.object({
  version: z.number().int().positive(),
  updatedAt: z.string(),
  settings: pricingSettingsSchema,
});

export const estimateResponseSchema = z.object({
  version: z.number().int().positive(),
  service: z.enum(publicServiceIds),
  status: z.enum(['priced', 'quote_required']),
  reason: z.string().nullable(),
  totalCents: cents.nullable(),
  coreCents: cents.nullable(),
  discountCents: cents,
  netCents: cents.nullable(),
  heavyCents: cents,
  addOnsCents: cents,
  travelCents: cents,
  subtotalCents: cents.nullable(),
  taxCents: cents.nullable(),
  taxBasisPoints: z.number().int().min(0).max(20_000).nullable(),
  lines: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      amountCents: cents,
      kind: z.enum(['core', 'discount', 'heavy', 'add_on', 'travel', 'subtotal', 'tax', 'total']),
      included: z.boolean().optional(),
      pending: z.boolean().optional(),
    }),
  ),
});

export const saveRateCardSchema = z
  .object({
    expectedVersion: z.number().int().positive(),
    settings: pricingSettingsSchema,
  })
  .strict();

export type PricingSettings = z.infer<typeof pricingSettingsSchema>;
export type EstimateInput = z.infer<typeof estimateInputSchema>;
export type EstimateResponse = z.infer<typeof estimateResponseSchema>;
export type PublicRateCard = z.infer<typeof publicRateCardSchema>;
