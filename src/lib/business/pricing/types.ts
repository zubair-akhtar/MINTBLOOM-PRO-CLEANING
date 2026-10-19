// @polsia:user-owned — v3 pricing rate-card and estimate types.

export type PricedServiceId = 'standard' | 'deep' | 'move' | 'airbnb';
export type QuoteOnlyServiceId = 'commercial' | 'postConstruction';
export type CalculatorServiceId = PricedServiceId | QuoteOnlyServiceId;

export type RecurringCadence = 'one_time' | 'weekly' | 'biweekly' | 'monthly';

export interface ServiceRateRow {
  baseCents: number;
  minimumCents: number;
  areaRateCentsPerSqFt: number;
  bedroomCents: number;
  bathCents: number;
  officeCents: number;
  extraLivingCents: number;
}

export interface AddonRate {
  id: string;
  label: string;
  /** Fixed cents, or unit pricing described by unitCents + optional minimumCents. */
  unitCents: number;
  minimumCents?: number;
  /** When true, Move includes one unit at $0. */
  includedInMove?: boolean;
  /** Services that may select this add-on. Empty = all priced residential. */
  services?: PricedServiceId[];
  /** Included automatically (not chargeable) for these services. */
  includedInServices?: PricedServiceId[];
}

export interface TravelBand {
  maxMilesInclusive: number | null;
  feeCents: number;
  /** When true, selecting this band forces quote_required. */
  quoteRequired?: boolean;
}

export interface PricingSettings {
  schemaVersion: 1;
  includedSqFt: number;
  maxAutoSqFt: number;
  maxAutoBathEquivalents: number;
  maxAutoBedrooms: number;
  commercialPerSqFtCents: number;
  services: Record<PricedServiceId, ServiceRateRow>;
  recurringDiscounts: {
    weekly: number;
    biweekly: number;
    monthly: number;
  };
  heavyConditionPercentOfCore: number;
  petHairCents: number;
  rushFeeCents: number;
  travelBands: TravelBand[];
  addOns: AddonRate[];
  /** Baseboards: cents per started 1000 sq ft; Standard/Airbnb only. */
  baseboardsPerStartedThousandCents: number;
  cabinetInteriorBaseCents: number;
  cabinetInteriorIncludedDoors: number;
  cabinetInteriorExtraDoorCents: number;
  linenChangeCents: number;
  airbnbIncludedBedChanges: number;
  airbnbExtraBedChangeCents: number;
  laundryLoadCents: number;
  maxAutoLaundryLoads: number;
  dishesBlockCents: number;
  maxAutoDishBlocks: number;
  garageBayCents: number;
  windowPaneCents: number;
  windowTracksCents: number;
  blindCents: number;
}

export interface EstimateLine {
  id: string;
  label: string;
  amountCents: number;
  taxable: boolean;
}

export interface EstimateInput {
  service: CalculatorServiceId;
  squareFeet: number | null;
  bedrooms: number | '5plus';
  fullBaths: number;
  halfBaths: number;
  offices: number;
  extraLivingRooms: number;
  kitchens: number;
  cadence: RecurringCadence;
  /** True when this is the first visit of a recurring plan (no discount). */
  isFirstRecurringVisit: boolean;
  addOnQuantities: Record<string, number>;
  heavyConditionApproved: boolean;
  petHairNeeded: boolean;
  rushRequested: boolean;
  travelMiles: number | null;
  highWorkRequested: boolean;
  severeOrUnknownCondition: boolean;
  marketPricingEnabled: boolean;
  taxRateBps: number | null;
}

export type EstimateStatus = 'priced' | 'quote_required';

export interface EstimateResult {
  status: EstimateStatus;
  reasons: string[];
  service: CalculatorServiceId;
  lines: EstimateLine[];
  coreCents: number;
  discountCents: number;
  minimumAdjustmentCents: number;
  netCoreCents: number;
  extrasCents: number;
  feesCents: number;
  subtotalCents: number;
  taxCents: number;
  totalCents: number;
  taxRateBps: number | null;
  bathEquivalents: number;
}
