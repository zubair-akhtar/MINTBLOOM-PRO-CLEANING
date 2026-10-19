// @polsia:user-owned — shared zod contracts for pricing estimate + admin settings.
import { z } from 'zod';

export const CalculatorServiceId = z.enum([
  'standard',
  'deep',
  'move',
  'airbnb',
  'commercial',
  'postConstruction',
]);

export const EstimateRequest = z.object({
  service: CalculatorServiceId,
  city: z.string().min(1).max(100),
  state: z.string().min(1).max(80),
  zip: z.string().min(3).max(10),
  squareFeet: z.number().int().positive().nullable(),
  bedrooms: z.union([z.number().int().min(0).max(4), z.literal('5plus')]),
  fullBaths: z.number().int().min(0).max(20),
  halfBaths: z.number().int().min(0).max(20),
  offices: z.number().int().min(0).max(20).default(0),
  extraLivingRooms: z.number().int().min(0).max(20).default(0),
  kitchens: z.number().int().min(1).max(10).default(1),
  cadence: z.enum(['one_time', 'weekly', 'biweekly', 'monthly']).default('one_time'),
  isFirstRecurringVisit: z.boolean().default(true),
  addOnQuantities: z.record(z.string(), z.number().int().min(0).max(100)).default({}),
  heavyConditionApproved: z.boolean().default(false),
  petHairNeeded: z.boolean().default(false),
  rushRequested: z.boolean().default(false),
  travelMiles: z.number().min(0).max(500).nullable().default(null),
  highWorkRequested: z.boolean().default(false),
  severeOrUnknownCondition: z.boolean().default(false),
});
export type EstimateRequest = z.infer<typeof EstimateRequest>;

export const EstimateLineSchema = z.object({
  id: z.string(),
  label: z.string(),
  amountCents: z.number().int(),
  taxable: z.boolean(),
});

export const EstimateResponse = z.object({
  status: z.enum(['priced', 'quote_required']),
  reasons: z.array(z.string()),
  service: CalculatorServiceId,
  lines: z.array(EstimateLineSchema),
  coreCents: z.number().int(),
  discountCents: z.number().int(),
  minimumAdjustmentCents: z.number().int(),
  netCoreCents: z.number().int(),
  extrasCents: z.number().int(),
  feesCents: z.number().int(),
  subtotalCents: z.number().int(),
  taxCents: z.number().int(),
  totalCents: z.number().int(),
  taxRateBps: z.number().int().nullable(),
  bathEquivalents: z.number(),
  rateCardVersion: z.number().int(),
  market: z
    .object({
      id: z.string(),
      name: z.string(),
      city: z.string(),
      state: z.string(),
      pricingEnabled: z.boolean(),
    })
    .nullable(),
  commercialReferenceCents: z.number().int().optional(),
});
export type EstimateResponse = z.infer<typeof EstimateResponse>;

export const AdminMarketSchema = z.object({
  id: z.string(),
  name: z.string(),
  city: z.string(),
  state: z.string(),
  isActive: z.boolean(),
  pricingEnabled: z.boolean(),
  combinedTaxRateBps: z.number().int().nullable(),
});

export const AdminPricingSettingsResponse = z.object({
  version: z.number().int(),
  label: z.string(),
  settings: z.record(z.string(), z.unknown()),
  markets: z.array(AdminMarketSchema),
});
export type AdminPricingSettingsResponse = z.infer<typeof AdminPricingSettingsResponse>;

export const AdminPricingSettingsPut = z.object({
  label: z.string().min(1).max(120).optional(),
  settings: z.record(z.string(), z.unknown()),
  markets: z
    .array(
      z.object({
        id: z.string(),
        combinedTaxRateBps: z.number().int().min(0).max(2000).nullable(),
        pricingEnabled: z.boolean(),
        isActive: z.boolean(),
      }),
    )
    .optional(),
});
export type AdminPricingSettingsPut = z.infer<typeof AdminPricingSettingsPut>;
