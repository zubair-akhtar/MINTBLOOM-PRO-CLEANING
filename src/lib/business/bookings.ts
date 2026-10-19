// @polsia:user-owned — server-only booking catalog, pricing, checkout, and fulfillment.
import 'server-only';

import type {
  BookingAddOnSelection,
  BookingCheckoutRequest,
  BookingCreate,
  BookingLine,
  BookingOptionsResponse as BookingOptionsResponseType,
  BookingQuoteRequest,
  BookingQuoteResponse,
  BookingSummary,
} from '@/lib/contracts/bookings';
import {
  BookingCheckoutRequest as BookingCheckoutRequestSchema,
  BookingOptionsResponse,
  BookingQuoteRequest as BookingQuoteRequestSchema,
} from '@/lib/contracts/bookings';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { bookingConfirmationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';
import { createCheckoutSession, verifyCheckoutSession } from '@/lib/stripe-billing/client';

type BedroomCount = 1 | 2 | 3 | 4 | 5;
type BathroomCount = 1 | 2 | 3;
type Cadence = BookingQuoteRequest['cadence'] & string;
type PriceTable = Record<NonNullable<Cadence>, Record<BedroomCount, Record<BathroomCount, number>>>;
type AddOnCatalogEntry = {
  id: string;
  label: string;
  description: string;
  unitLabel: string;
  quantityLabel: string;
  minQuantity: number;
  maxQuantity: number;
  priceCents: number | null;
  startingPriceCents: number | null;
  displayPrice: string;
  pricingStatus: 'approved' | 'starting_price' | 'quote_required';
  scope: string;
  quoteReason: string;
};

// These are the saved roadmap baselines. The existing size/cadence matrix below
// remains the approved recurring menu; no browser value can create a new price.
export const INITIAL_BASELINE_CENTS = 18500;
export const RECURRING_BASELINE_CENTS = 13500;

// Existing approved recurring size/cadence decisions, retained additively.
export const PRICE_MATRIX_CENTS: PriceTable = {
  weekly: {
    1: { 1: 14900, 2: 16900, 3: 18900 },
    2: { 1: 16900, 2: 18900, 3: 20900 },
    3: { 1: 18900, 2: 20900, 3: 22900 },
    4: { 1: 21900, 2: 23900, 3: 25900 },
    5: { 1: 24900, 2: 26900, 3: 28900 },
  },
  biweekly: {
    1: { 1: 12900, 2: 14900, 3: 16900 },
    2: { 1: 14900, 2: 16900, 3: 18900 },
    3: { 1: 16900, 2: 18900, 3: 20900 },
    4: { 1: 19900, 2: 21900, 3: 23900 },
    5: { 1: 22900, 2: 24900, 3: 26900 },
  },
  monthly: {
    1: { 1: 9900, 2: 11900, 3: 13900 },
    2: { 1: 11900, 2: 13900, 3: 15900 },
    3: { 1: 13900, 2: 15900, 3: 17900 },
    4: { 1: 16900, 2: 18900, 3: 20900 },
    5: { 1: 19900, 2: 21900, 3: 23900 },
  },
};

export const SERVICE_CONTENT = {
  basicResidential: {
    label: 'Basic / regular residential clean',
    shortDescription: 'A dependable routine reset for a lived-in home.',
    inclusions: [
      'Kitchen and bathroom surfaces',
      'Dusting and vacuuming',
      'Mopping accessible floors',
    ],
    exclusions: [
      'Inside cabinets or appliances',
      'Exterior windows',
      'Heavy lifting or post-construction debris',
    ],
    pricingStatus: 'starting_price' as const,
    startingPriceCents: INITIAL_BASELINE_CENTS,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby'] as const,
  },
  oneTimeResidential: {
    label: 'One-time residential clean',
    shortDescription: 'One visit, no recurring commitment, with the same clear scope.',
    inclusions: [
      'Kitchen and bathroom surfaces',
      'Dusting and vacuuming',
      'Mopping accessible floors',
    ],
    exclusions: [
      'Inside cabinets or appliances',
      'Exterior windows',
      'Heavy lifting or post-construction debris',
    ],
    pricingStatus: 'starting_price' as const,
    startingPriceCents: INITIAL_BASELINE_CENTS,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
  recurringResidential: {
    label: 'Recurring residential clean',
    shortDescription:
      'Keep the reset on your calendar with a weekly, biweekly, or monthly cadence.',
    inclusions: [
      'Kitchen and bathroom surfaces',
      'Dusting and vacuuming',
      'Mopping accessible floors',
      'Routine visit notes',
    ],
    exclusions: [
      'Inside cabinets or appliances',
      'Exterior windows',
      'Heavy lifting or post-construction debris',
    ],
    pricingStatus: 'starting_price' as const,
    startingPriceCents: RECURRING_BASELINE_CENTS,
    permittedCadences: ['weekly', 'biweekly', 'monthly'] as const,
    permittedAreas: ['core', 'nearby'] as const,
  },
  deepCleaning: {
    label: 'Deep cleaning',
    shortDescription: 'Buildup-focused detail work for a home that needs a fuller reset.',
    inclusions: [
      'Buildup-focused kitchen and bathroom cleaning',
      'Reachable fixtures, ledges, edges, and baseboards where accessible',
      'Detailed dusting, vacuuming, and mopping of reachable areas',
    ],
    exclusions: [
      'Permanent stains, damage, or restoration work',
      'High-risk, delicate, or specialty materials that need specialist care',
      'Repairs, paint work, hauling, or exterior work',
      'Post-construction debris or hazardous-material cleanup',
    ],
    pricingStatus: 'quote_required' as const,
    startingPriceCents: null,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
  moveInMoveOut: {
    label: 'Move-in / move-out clean',
    shortDescription: 'A detailed turnover scope for an empty or nearly empty space.',
    inclusions: [
      'Empty-home surfaces',
      'Kitchen and bathroom detail',
      'Floors and reachable fixtures',
    ],
    exclusions: ['Construction cleanup', 'Exterior windows', 'Repairs, hauling, or paint work'],
    pricingStatus: 'quote_required' as const,
    startingPriceCents: null,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
  officeCommercial: {
    label: 'Office / commercial clean',
    shortDescription: 'A tailored scope for offices, clinics, retail, and other commercial spaces.',
    inclusions: [
      'Shared-area surface cleaning',
      'Restrooms and break areas',
      'A scope matched to your operating hours',
    ],
    exclusions: [
      'Medical waste or hazardous materials',
      'Construction cleanup',
      'Repairs, hauling, or exterior work',
    ],
    pricingStatus: 'quote_required' as const,
    startingPriceCents: null,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
  postConstruction: {
    label: 'Post-construction clean',
    shortDescription: 'A detail-focused clean for a finished build before handover or move-in.',
    inclusions: [
      'Construction dust detail on reachable surfaces',
      'Kitchen, bathroom, fixture, and floor cleaning',
      'A scope review for residue, windows, and punch-list needs',
    ],
    exclusions: [
      'Heavy debris hauling or construction labor',
      'Hazardous-material remediation or paint correction',
      'Final pricing before the property and residue are reviewed',
    ],
    pricingStatus: 'quote_required' as const,
    startingPriceCents: null,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
  medicalGradeSanitation: {
    label: 'Medical-grade sanitation',
    shortDescription:
      'A sanitation-focused scope for eligible spaces with human review before work.',
    inclusions: [
      'Sanitation-focused cleaning of the reviewed scope',
      'High-touch and hard-surface attention where appropriate',
      'A human review of materials, access, and requested controls',
    ],
    exclusions: [
      'Blanket sterilization or healthcare-compliance certification',
      'Hazardous medical-waste handling or remediation',
      'Final pricing before the scope and site conditions are reviewed',
    ],
    pricingStatus: 'quote_required' as const,
    startingPriceCents: null,
    permittedCadences: [] as NonNullable<Cadence>[],
    permittedAreas: ['core', 'nearby', 'extended'] as const,
  },
} as const;

// Mintbloom launch pricing, not a market standard. These fixed prices are
// intentionally limited to the stated unit and scope; condition, size, safety,
// specialty-material, and travel exceptions stay quote-required.
export const BOOKING_ADD_ONS: AddOnCatalogEntry[] = [
  {
    id: 'dishes',
    label: 'Dishes or one dishwasher / sink load',
    description:
      'One load of dishes only; loading or unloading one dishwasher or sink load, not a full kitchen reset.',
    unitLabel: 'load',
    quantityLabel: 'Loads',
    minQuantity: 1,
    maxQuantity: 2,
    priceCents: 2500,
    startingPriceCents: null,
    displayPrice: '$25 / load',
    pricingStatus: 'approved',
    scope: '1–2 standard loads with light dish handling.',
    quoteReason:
      'Quote required for a full kitchen reset, heavy or baked-on cookware, or more than 2 loads.',
  },
  {
    id: 'insideMicrowave',
    label: 'Inside the microwave',
    description:
      'Interior wipe-down of one reachable microwave; no appliance repair or dismantling.',
    unitLabel: 'microwave',
    quantityLabel: 'Microwaves',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 1500,
    startingPriceCents: null,
    displayPrice: '$15 / microwave',
    pricingStatus: 'approved',
    scope: '1 reachable, emptied microwave.',
    quoteReason: 'Quote required for unsafe, damaged, or specialty appliances.',
  },
  {
    id: 'insideOven',
    label: 'Inside the oven',
    description:
      'Interior cleaning of one oven that is cool and safe to access; no repairs or degreasing of damaged surfaces.',
    unitLabel: 'oven',
    quantityLabel: 'Ovens',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 5000,
    startingPriceCents: null,
    displayPrice: '$50 / oven',
    pricingStatus: 'approved',
    scope: '1 cool, reachable oven at ordinary soil level.',
    quoteReason:
      'Quote required for unsafe access, severe baked-on buildup, specialty materials, or dismantling.',
  },
  {
    id: 'insideFridge',
    label: 'Inside the refrigerator',
    description:
      'Interior wipe-down of one emptied, reachable refrigerator; no spoiled-food removal or appliance repair.',
    unitLabel: 'refrigerator',
    quantityLabel: 'Refrigerators',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 5000,
    startingPriceCents: null,
    displayPrice: '$50 / refrigerator',
    pricingStatus: 'approved',
    scope: '1 emptied, reachable refrigerator with ordinary interior soil.',
    quoteReason:
      'Quote required for spoiled-food removal, extreme condition, freezer or specialty units, or repairs.',
  },
  {
    id: 'baseboardDetail',
    label: 'Baseboard detail',
    description:
      'Detail cleaning of reachable baseboards in the selected home; moving heavy furniture is not included.',
    unitLabel: 'home',
    quantityLabel: 'Homes',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 6000,
    startingPriceCents: null,
    displayPrice: '$60 / home',
    pricingStatus: 'approved',
    scope: '1 standard home with reachable baseboards; no heavy furniture moving.',
    quoteReason:
      'Quote required for unusually large or occupied scope or buildup beyond this visit.',
  },
  {
    id: 'lightWallSpotCleaning',
    label: 'Light wall spot-cleaning',
    description:
      'Small, washable wall marks only; this is not paint work, stain restoration, or drywall repair.',
    unitLabel: 'home',
    quantityLabel: 'Homes',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 3000,
    startingPriceCents: null,
    displayPrice: '$30 / home',
    pricingStatus: 'approved',
    scope:
      'Up to 10 washable wall spots in 1 home; no paint, drywall, restoration, or high access.',
    quoteReason:
      'Quote required for more than 10 spots, damage, specialty paint or material, or ladder work.',
  },
  {
    id: 'additionalBathroom',
    label: 'Additional bathroom beyond home scope',
    description:
      'One bathroom beyond the selected home scope; bathrooms already covered by the base service are never charged twice.',
    unitLabel: 'additional bathroom',
    quantityLabel: 'Additional bathrooms',
    minQuantity: 1,
    maxQuantity: 2,
    priceCents: 3500,
    startingPriceCents: null,
    displayPrice: '$35 / bathroom',
    pricingStatus: 'approved',
    scope: 'Up to 2 bathrooms beyond the selected base scope.',
    quoteReason:
      'Quote required for an already-included bathroom, an unusually large or condition-heavy space, or more than 2.',
  },
  {
    id: 'bedMaking',
    label: 'Bed-making or linen change',
    description:
      'One bed made or changed per unit using customer-provided clean linens; no linen laundering or mattress cleaning.',
    unitLabel: 'bed',
    quantityLabel: 'Beds',
    minQuantity: 1,
    maxQuantity: 5,
    priceCents: 2000,
    startingPriceCents: null,
    displayPrice: '$20 / bed',
    pricingStatus: 'approved',
    scope: 'Up to 5 beds using customer-provided clean linens; no laundering or mattress cleaning.',
    quoteReason:
      'Quote required for laundering, mattress cleaning, missing or unclean linens, or more than 5 beds.',
  },
  {
    id: 'interiorWindows',
    label: 'Interior windows',
    description:
      'Interior glass and reachable sill detail per window; no exterior glass, high-access work, screens, or repairs.',
    unitLabel: 'window',
    quantityLabel: 'Windows',
    minQuantity: 1,
    maxQuantity: 20,
    priceCents: 1000,
    startingPriceCents: null,
    displayPrice: '$10 / window',
    pricingStatus: 'approved',
    scope: '1–20 reachable interior panes and sills.',
    quoteReason:
      'Quote required for exterior glass, high access, screens or tracks beyond scope, specialty glass, or more than 20.',
  },
  {
    id: 'blinds',
    label: 'Blinds',
    description:
      'Dusting and light wipe of reachable blinds per unit; no removal, repair, or restoration of delicate coverings.',
    unitLabel: 'blind',
    quantityLabel: 'Blinds',
    minQuantity: 1,
    maxQuantity: 20,
    priceCents: 1000,
    startingPriceCents: null,
    displayPrice: '$10 / blind',
    pricingStatus: 'approved',
    scope: '1–20 reachable standard blinds with light dusting or wipe.',
    quoteReason:
      'Quote required for removal, repair, delicate coverings, heavy buildup, or more than 20.',
  },
  {
    id: 'insideKitchenCabinets',
    label: 'Inside kitchen cabinets',
    description:
      'Interior wipe-down of emptied, reachable kitchen cabinets per cabinet section; no heavy-item moving or repairs.',
    unitLabel: 'kitchen',
    quantityLabel: 'Kitchens',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 6000,
    startingPriceCents: null,
    displayPrice: '$60 / kitchen',
    pricingStatus: 'approved',
    scope: '1 kitchen with up to 12 emptied, reachable sections.',
    quoteReason:
      'Quote required for packed or greasy condition, oversized kitchens, heavy-item moving, repairs, or more than 12 sections.',
  },
  {
    id: 'laundry',
    label: 'Laundry wash / dry / fold',
    description:
      'One customer-provided laundry load washed, dried, and folded per unit; no ironing, dry cleaning, or stain treatment.',
    unitLabel: 'load',
    quantityLabel: 'Loads',
    minQuantity: 1,
    maxQuantity: 5,
    priceCents: 3000,
    startingPriceCents: null,
    displayPrice: '$30 / load',
    pricingStatus: 'approved',
    scope: '1–5 customer-provided standard loads washed, dried, and folded.',
    quoteReason:
      'Quote required for stain treatment, dry cleaning, oversized or contaminated loads, ironing, or more than 5.',
  },
  {
    id: 'petHairHeavyBuildup',
    label: 'Extra pet-hair / heavy-buildup treatment',
    description:
      'Additional time for one home with heavier pet hair or buildup; final scope depends on condition and safe access.',
    unitLabel: 'home',
    quantityLabel: 'Homes',
    minQuantity: 1,
    maxQuantity: 1,
    priceCents: 5000,
    startingPriceCents: null,
    displayPrice: '$50 / home',
    pricingStatus: 'approved',
    scope: '1 standard treatment within the catalog’s extra-time scope.',
    quoteReason:
      'Quote required for extreme buildup, infestation or hazard, restoration, unsafe access, or a materially larger job.',
  },
] as const;

const CORE_ZIPS = new Set([
  '79401',
  '79402',
  '79403',
  '79404',
  '79406',
  '79407',
  '79408',
  '79409',
  '79410',
  '79411',
  '79412',
  '79413',
  '79414',
  '79415',
  '79416',
  '79423',
  '79424',
  '79430',
  '79452',
  '79453',
  '79464',
]);
const NEARBY_ZIPS = new Set([
  '79311',
  '79316',
  '79336',
  '79350',
  '79363',
  '79364',
  '79366',
  '79373',
  '79381',
  '79382',
  '79383',
]);

export function classifyBookingArea(input: { zip: string; state?: string }) {
  if (input.state && input.state.trim().toUpperCase() !== 'TX') return 'extended' as const;
  if (CORE_ZIPS.has(input.zip)) return 'core' as const;
  if (NEARBY_ZIPS.has(input.zip)) return 'nearby' as const;
  return 'extended' as const;
}

function formatAmount(amountCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amountCents / 100,
  );
}

function toUtcDate(serviceDate: string): Date {
  return new Date(`${serviceDate}T00:00:00.000Z`);
}

function toDateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function serviceOption(id: keyof typeof SERVICE_CONTENT) {
  const service = SERVICE_CONTENT[id];
  return {
    id,
    ...service,
    startingPrice:
      service.startingPriceCents === null
        ? 'Quote required'
        : `Starting at ${formatAmount(service.startingPriceCents)}`,
    permittedAreas: [...service.permittedAreas],
    permittedCadences: [...service.permittedCadences],
  };
}

export function getBookingOptions(): BookingOptionsResponseType {
  return BookingOptionsResponse.parse({
    services: (Object.keys(SERVICE_CONTENT) as Array<keyof typeof SERVICE_CONTENT>).map(
      serviceOption,
    ),
    addOns: BOOKING_ADD_ONS.map((addOn) => ({
      ...addOn,
      priceCents: null,
      startingPriceCents: addOn.priceCents,
      displayPrice: `Starting at ${addOn.displayPrice}`,
      pricingStatus: 'starting_price' as const,
    })),
    areaNotes: {
      core: 'Lubbock core ZIP codes are eligible for the residential menu.',
      nearby:
        'Approved nearby ZIP codes can use residential service; recurring remains within this Lubbock-area list.',
      extended:
        'Outside the approved Lubbock-area list, we review travel and scope before quoting.',
    },
  });
}

function cadenceLabel(cadence: BookingQuoteRequest['cadence'] | null): string | null {
  if (cadence === 'weekly') return 'Weekly';
  if (cadence === 'biweekly') return 'Biweekly';
  if (cadence === 'monthly') return 'Monthly';
  return null;
}

function serviceTier(cadence: BookingQuoteRequest['cadence']): 'weekly' | 'biweekly' | 'monthly' {
  return cadence ?? 'monthly';
}

function line(
  id: string,
  label: string,
  amountCents: number,
  options?: {
    quantity?: number;
    unitLabel?: string;
    displayAmount?: string;
    pricingStatus?: BookingLine['pricingStatus'];
    scope?: string | null;
    quoteReason?: string | null;
  },
): BookingLine {
  return {
    id,
    label,
    quantity: options?.quantity ?? 1,
    unitLabel: options?.unitLabel ?? 'service',
    amountCents,
    displayAmount: options?.displayAmount ?? formatAmount(amountCents),
    pricingStatus: options?.pricingStatus ?? 'approved',
    scope: options?.scope ?? null,
    quoteReason: options?.quoteReason ?? null,
  };
}

function quoteLineForAddOn(
  addOn: AddOnCatalogEntry,
  quantity: number,
  quoteRequired = false,
): BookingLine {
  const amountCents = quoteRequired || addOn.priceCents === null ? 0 : addOn.priceCents * quantity;
  return {
    id: addOn.id,
    label: addOn.label,
    quantity,
    unitLabel: addOn.unitLabel,
    amountCents,
    displayAmount:
      quoteRequired || addOn.priceCents === null ? 'Quote required' : formatAmount(amountCents),
    pricingStatus: quoteRequired ? 'quote_required' : addOn.pricingStatus,
    scope: addOn.scope,
    quoteReason: addOn.quoteReason,
  };
}

function summaryFor(
  input: BookingQuoteRequest,
  areaClassification: BookingSummary['areaClassification'],
  baseAmountCents: number,
  selectedAddOns: BookingLine[],
  servicePricingStatus: BookingSummary['pricingStatus'],
): BookingSummary {
  const service = SERVICE_CONTENT[input.serviceType];
  const travelPricingStatus = areaClassification === 'extended' ? 'quote_required' : 'approved';
  const travelDisplayAmount = travelPricingStatus === 'quote_required' ? 'Quote required' : '$0.00';
  const serviceLine = line('service', service.label, baseAmountCents, {
    displayAmount:
      baseAmountCents > 0
        ? servicePricingStatus === 'starting_price'
          ? `Starting at ${formatAmount(baseAmountCents)}`
          : formatAmount(baseAmountCents)
        : 'Quote required',
    pricingStatus: servicePricingStatus,
  });
  const lines = [serviceLine, ...selectedAddOns];
  lines.push(
    line('travel', 'Round-trip travel', 0, {
      displayAmount: travelDisplayAmount,
      pricingStatus: travelPricingStatus,
    }),
  );
  const totalAmountCents = lines.reduce((total, item) => total + item.amountCents, 0);
  const hasQuoteRequiredLine = lines.some((item) => item.pricingStatus === 'quote_required');
  const pricingStatus = hasQuoteRequiredLine
    ? 'quote_required'
    : lines.some((item) => item.pricingStatus === 'starting_price')
      ? 'starting_price'
      : 'approved';
  return {
    serviceType: input.serviceType,
    serviceLabel: service.label,
    cadence: input.cadence ?? null,
    cadenceLabel: cadenceLabel(input.cadence),
    inclusions: [...service.inclusions],
    exclusions: [...service.exclusions],
    selectedAddOns,
    pricingStatus,
    baseAmountCents,
    travelChargeCents: 0,
    travelPricingStatus,
    totalAmountCents,
    baseDisplayAmount:
      baseAmountCents > 0
        ? servicePricingStatus === 'starting_price'
          ? `Starting at ${formatAmount(baseAmountCents)}`
          : formatAmount(baseAmountCents)
        : 'Quote required',
    travelDisplayAmount,
    totalDisplayAmount:
      pricingStatus === 'approved'
        ? formatAmount(totalAmountCents)
        : pricingStatus === 'starting_price' && baseAmountCents > 0
          ? `Starting at ${formatAmount(baseAmountCents)}`
          : 'Quote required',
    areaClassification,
    lines,
  };
}

export class BookingCatalogValidationError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'BookingCatalogValidationError';
  }
}

function selectedAddOnLines(selections: BookingAddOnSelection[]): BookingLine[] {
  const seen = new Set<string>();
  return selections.map((selection) => {
    if (seen.has(selection.id)) {
      throw new BookingCatalogValidationError(
        'Choose each add-on once and adjust its quantity instead.',
      );
    }
    seen.add(selection.id);
    const addOn = BOOKING_ADD_ONS.find((candidate) => candidate.id === selection.id);
    if (!addOn) {
      throw new BookingCatalogValidationError(`Unknown add-on: ${selection.id}.`);
    }
    if (selection.quantity < addOn.minQuantity) {
      throw new BookingCatalogValidationError(
        `${addOn.label} requires at least ${addOn.minQuantity} ${addOn.unitLabel}${addOn.minQuantity === 1 ? '' : 's'}.`,
      );
    }
    return quoteLineForAddOn(addOn, selection.quantity, selection.quantity > addOn.maxQuantity);
  });
}

export function calculateBookingQuote(input: BookingQuoteRequest): BookingQuoteResponse {
  const parsed = BookingQuoteRequestSchema.parse(input);
  const areaClassification = classifyBookingArea(parsed);
  const selectedAddOns = selectedAddOnLines(parsed.addOnSelections);
  const service = SERVICE_CONTENT[parsed.serviceType];
  let baseAmountCents = 0;
  if (parsed.serviceType === 'basicResidential' || parsed.serviceType === 'oneTimeResidential') {
    baseAmountCents = INITIAL_BASELINE_CENTS;
  } else if (parsed.serviceType === 'recurringResidential' && parsed.cadence) {
    baseAmountCents =
      PRICE_MATRIX_CENTS[parsed.cadence][parsed.bedrooms as BedroomCount][
        parsed.bathrooms as BathroomCount
      ];
  }

  const summary = summaryFor(
    parsed,
    areaClassification,
    baseAmountCents,
    selectedAddOns,
    service.pricingStatus,
  );
  const reasons: string[] = [];
  if (service.pricingStatus === 'quote_required') {
    if (parsed.serviceType === 'deepCleaning') {
      reasons.push(
        'Deep cleaning pricing depends on condition and the size of the buildup-focused scope.',
      );
    } else if (parsed.serviceType === 'moveInMoveOut') {
      reasons.push(
        'Move-in / move-out pricing depends on condition, space size, and whether the space is empty.',
      );
    } else if (parsed.serviceType === 'officeCommercial') {
      reasons.push(
        'Commercial pricing depends on space size, operating hours, and the requested scope.',
      );
    } else if (parsed.serviceType === 'postConstruction') {
      reasons.push(
        'Post-construction pricing depends on property size, remaining residue, access, and the final-clean scope.',
      );
    } else if (parsed.serviceType === 'medicalGradeSanitation') {
      reasons.push(
        'Medical-grade sanitation pricing requires human review of the sanitation scope, surfaces, access, and safety conditions.',
      );
    }
  }
  if (areaClassification === 'extended') {
    reasons.push(
      'Travel pricing depends on distance outside the approved Lubbock and nearby service area.',
    );
  }
  if (parsed.serviceType === 'recurringResidential' && areaClassification === 'extended') {
    reasons.push(
      'Recurring service is currently available only in the approved Lubbock and nearby area.',
    );
  }
  if (!(service.permittedAreas as readonly string[]).includes(areaClassification)) {
    reasons.push(`${service.label} is not currently available in this service area.`);
  }
  if (selectedAddOns.some((addOn) => addOn.pricingStatus !== 'approved')) {
    const addOnReasons = [
      ...new Set(
        selectedAddOns
          .filter((addOn) => addOn.pricingStatus !== 'approved')
          .map((addOn) => addOn.quoteReason)
          .filter((reason): reason is string => Boolean(reason)),
      ),
    ];
    reasons.push(addOnReasons.join(' '));
  }
  if (reasons.length > 0) {
    return {
      status: 'quote_required',
      summary: {
        ...summary,
        pricingStatus: 'quote_required',
        totalDisplayAmount: 'Quote required',
      },
      reason: reasons.join(' '),
    };
  }
  return {
    status: 'quote_required',
    summary,
    reason: 'Final pricing is confirmed after human review of the service and property details.',
  };
}

export class BookingQuoteRequiredError extends Error {
  readonly quote: Extract<BookingQuoteResponse, { status: 'quote_required' }>;

  constructor(quote: Extract<BookingQuoteResponse, { status: 'quote_required' }>) {
    super(quote.reason);
    this.name = 'BookingQuoteRequiredError';
    this.quote = quote;
  }
}

function jsonArray(values: string[]) {
  return values;
}

function checkoutSnapshot(
  input: BookingCreate,
  quote: Extract<BookingQuoteResponse, { status: 'priced' }>,
) {
  return {
    idempotencyKey: '',
    fullName: input.fullName,
    email: input.email,
    phone: input.phone,
    addressLine1: input.addressLine1,
    addressLine2: input.addressLine2 || null,
    city: input.city,
    state: input.state,
    zip: input.zip,
    bedrooms: input.bedrooms,
    bathrooms: input.bathrooms,
    tier: serviceTier(input.cadence),
    serviceType: input.serviceType,
    cadence: input.cadence ?? null,
    serviceDate: toUtcDate(input.serviceDate),
    amountCents: quote.summary.totalAmountCents,
    baseAmountCents: quote.summary.baseAmountCents,
    travelChargeCents: quote.summary.travelChargeCents,
    totalAmountCents: quote.summary.totalAmountCents,
    areaClassification: quote.summary.areaClassification,
    inclusions: jsonArray(quote.summary.inclusions),
    exclusions: jsonArray(quote.summary.exclusions),
    selectedAddOns: quote.summary.selectedAddOns,
  };
}

export async function startBookingCheckout(input: BookingCheckoutRequest) {
  const parsed = BookingCheckoutRequestSchema.parse(input);
  const quote = calculateBookingQuote(parsed);
  if (quote.status !== 'priced') throw new BookingQuoteRequiredError(quote);

  const existing = await prisma.bookingCheckoutDraft.findUnique({
    where: { idempotencyKey: parsed.idempotencyKey },
  });
  if (existing?.checkoutUrl && existing.checkoutSessionId) {
    return { checkoutUrl: existing.checkoutUrl, checkoutSessionId: existing.checkoutSessionId };
  }

  const snapshot = checkoutSnapshot(parsed, quote);
  const draft =
    existing ??
    (await prisma.bookingCheckoutDraft.create({
      data: { ...snapshot, idempotencyKey: parsed.idempotencyKey },
    }));

  const appUrl = env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '');
  const checkout = await createCheckoutSession({
    lineItems: quote.summary.lines
      .filter((item) => item.amountCents > 0)
      .map((item) => ({
        name: item.label,
        amountUsd: item.amountCents / 100,
        quantity: 1,
      })),
    name: `Mintbloom ${quote.summary.serviceLabel}`,
    description: [
      quote.summary.cadenceLabel,
      `${parsed.bedrooms}-bedroom, ${parsed.bathrooms}-bathroom home`,
    ]
      .filter(Boolean)
      .join(' · '),
    customerEmail: parsed.email,
    successUrl: `${appUrl}/book/confirmed?session_id={CHECKOUT_SESSION_ID}`,
    cancelUrl: `${appUrl}/book`,
    clientReferenceId: draft.id,
    billingAddressCollection: 'required',
    collectPhoneNumber: true,
    submitType: 'book',
  });

  await prisma.bookingCheckoutDraft.update({
    where: { id: draft.id },
    data: { checkoutSessionId: checkout.stripeSessionId, checkoutUrl: checkout.url },
  });
  return { checkoutUrl: checkout.url, checkoutSessionId: checkout.stripeSessionId };
}

function centsFromUsd(amountUsd: number): number | null {
  if (!Number.isFinite(amountUsd) || amountUsd <= 0) return null;
  const cents = Math.round(amountUsd * 100);
  return Number.isSafeInteger(cents) ? cents : null;
}

function stringArray(value: unknown): string[] {
  return Array.isArray(value) && value.every((item) => typeof item === 'string') ? value : [];
}

function lineArray(value: unknown): BookingLine[] {
  if (!Array.isArray(value)) return [];
  return value.flatMap((item) => {
    if (!item || typeof item !== 'object') return [];
    const record = item as Record<string, unknown>;
    if (
      typeof record.id !== 'string' ||
      typeof record.label !== 'string' ||
      typeof record.amountCents !== 'number' ||
      typeof record.displayAmount !== 'string'
    ) {
      return [];
    }
    return [
      {
        id: record.id,
        label: record.label,
        quantity: typeof record.quantity === 'number' ? record.quantity : 1,
        unitLabel: typeof record.unitLabel === 'string' ? record.unitLabel : 'service',
        amountCents: record.amountCents,
        displayAmount: record.displayAmount,
        pricingStatus:
          record.pricingStatus === 'quote_required' || record.pricingStatus === 'starting_price'
            ? record.pricingStatus
            : 'approved',
        scope: typeof record.scope === 'string' ? record.scope : null,
        quoteReason: typeof record.quoteReason === 'string' ? record.quoteReason : null,
      },
    ];
  });
}

function summaryFromStored(booking: {
  serviceType: keyof typeof SERVICE_CONTENT;
  cadence: 'weekly' | 'biweekly' | 'monthly' | null;
  baseAmountCents: number;
  travelChargeCents: number;
  totalAmountCents: number;
  areaClassification: string;
  inclusions: unknown;
  exclusions: unknown;
  selectedAddOns: unknown;
}): BookingSummary {
  const service = SERVICE_CONTENT[booking.serviceType];
  const area =
    booking.areaClassification === 'nearby' || booking.areaClassification === 'extended'
      ? booking.areaClassification
      : 'core';
  const addOns = lineArray(booking.selectedAddOns);
  const travelPricingStatus = area === 'extended' ? 'quote_required' : 'approved';
  const lines = [
    line('service', service.label, booking.baseAmountCents, {
      pricingStatus: booking.baseAmountCents > 0 ? 'approved' : 'quote_required',
    }),
    ...addOns,
    line('travel', 'Round-trip travel', booking.travelChargeCents, {
      displayAmount:
        travelPricingStatus === 'quote_required'
          ? 'Quote required'
          : booking.travelChargeCents > 0
            ? formatAmount(booking.travelChargeCents)
            : '$0.00',
      pricingStatus: travelPricingStatus,
    }),
  ];
  const pricingStatus = lines.some((item) => item.pricingStatus === 'quote_required')
    ? 'quote_required'
    : lines.some((item) => item.pricingStatus === 'starting_price')
      ? 'starting_price'
      : 'approved';
  return {
    serviceType: booking.serviceType,
    serviceLabel: service.label,
    cadence: booking.cadence,
    cadenceLabel: cadenceLabel(booking.cadence),
    inclusions: stringArray(booking.inclusions),
    exclusions: stringArray(booking.exclusions),
    selectedAddOns: addOns,
    pricingStatus,
    baseAmountCents: booking.baseAmountCents,
    travelChargeCents: booking.travelChargeCents,
    travelPricingStatus,
    totalAmountCents: booking.totalAmountCents,
    baseDisplayAmount:
      booking.baseAmountCents > 0 ? formatAmount(booking.baseAmountCents) : 'Quote required',
    travelDisplayAmount: lines.at(-1)?.displayAmount ?? '$0.00',
    totalDisplayAmount:
      pricingStatus === 'approved' ? formatAmount(booking.totalAmountCents) : 'Quote required',
    areaClassification: area,
    lines,
  };
}

export type BookingConfirmationResult =
  | { status: 'pending'; message: string }
  | { status: 'invalid'; message: string }
  | { status: 'error'; code: string; message: string }
  | {
      status: 'confirmed';
      booking: {
        id: string;
        fullName: string;
        email: string;
        phone: string;
        addressLine1: string;
        addressLine2: string | null;
        city: string;
        state: string;
        zip: string;
        serviceDate: string;
        summary: BookingSummary;
      };
      payment: {
        amountCents: number;
        displayAmount: string;
        customerEmail: string | null;
        paidAt: string | null;
      };
    };

async function drainBookingEmail() {
  const pending = await prisma.bookingEmailOutbox.findFirst({
    where: { status: 'queued' },
    orderBy: { createdAt: 'asc' },
  });
  if (!pending) return;
  const claim = await prisma.bookingEmailOutbox.updateMany({
    where: { id: pending.id, status: 'queued' },
    data: { status: 'claimed', claimedAt: new Date(), attempts: { increment: 1 } },
  });
  if (claim.count !== 1) return;
  try {
    await sendEmail({
      to: pending.recipient,
      subject: pending.subject,
      html: pending.htmlBody,
      text: pending.textBody,
    });
    await prisma.bookingEmailOutbox.update({
      where: { id: pending.id },
      data: { status: 'sent', sentAt: new Date(), lastError: null },
    });
  } catch (error) {
    await prisma.bookingEmailOutbox.update({
      where: { id: pending.id },
      data: {
        status: 'queued',
        lastError: error instanceof Error ? error.message : 'Email send failed',
      },
    });
  }
}

export async function confirmBookingPayment(input: {
  sessionId: string;
}): Promise<BookingConfirmationResult> {
  const verification = await verifyCheckoutSession(input);
  if (!verification.verified || !verification.payment) {
    return { status: 'pending', message: 'Payment is still settling. We are checking again.' };
  }

  const draft = await prisma.bookingCheckoutDraft.findUnique({
    where: { checkoutSessionId: input.sessionId },
  });
  if (!draft) {
    return {
      status: 'invalid',
      message: 'We could not match this payment to a Mintbloom booking.',
    };
  }

  const paidAmountCents = centsFromUsd(verification.payment.amount_usd);
  if (paidAmountCents === null || paidAmountCents !== draft.totalAmountCents) {
    return {
      status: 'error',
      code: 'payment_amount_mismatch',
      message: 'The payment amount did not match this booking. Please contact Mintbloom support.',
    };
  }

  const paidAt = verification.payment.paid_at ? new Date(verification.payment.paid_at) : null;
  const fulfillment = await prisma.$transaction(async (transaction) => {
    const existing = await transaction.bookingPaymentFulfillment.findUnique({
      where: { checkoutSessionId: input.sessionId },
    });
    if (existing) return existing;

    const booking = await transaction.booking.create({
      data: {
        fullName: draft.fullName,
        email: draft.email,
        phone: draft.phone,
        addressLine1: draft.addressLine1,
        addressLine2: draft.addressLine2,
        city: draft.city,
        state: draft.state,
        zip: draft.zip,
        bedrooms: draft.bedrooms,
        bathrooms: draft.bathrooms,
        tier: draft.tier,
        serviceType: draft.serviceType,
        cadence: draft.cadence,
        serviceDate: draft.serviceDate,
        quotedAmountCents: draft.totalAmountCents,
        paymentAmountCents: paidAmountCents,
        baseAmountCents: draft.baseAmountCents,
        travelChargeCents: draft.travelChargeCents,
        totalAmountCents: draft.totalAmountCents,
        areaClassification: draft.areaClassification,
        inclusions: stringArray(draft.inclusions),
        exclusions: stringArray(draft.exclusions),
        selectedAddOns: lineArray(draft.selectedAddOns),
        checkoutSessionId: input.sessionId,
      },
    });
    const summary = summaryFromStored(booking);
    const email = bookingConfirmationEmail({
      name: draft.fullName,
      bookingId: booking.id,
      summary,
      serviceDate: toDateOnly(draft.serviceDate),
    });
    await transaction.bookingEmailOutbox.create({
      data: {
        bookingId: booking.id,
        recipient: draft.email,
        subject: email.subject,
        textBody: email.text ?? '',
        htmlBody: email.html,
      },
    });
    await transaction.bookingCheckoutDraft.update({
      where: { id: draft.id },
      data: { status: 'fulfilled' },
    });
    return transaction.bookingPaymentFulfillment.create({
      data: {
        checkoutSessionId: input.sessionId,
        bookingId: booking.id,
        amountCents: paidAmountCents,
        paidAt,
      },
    });
  });

  await drainBookingEmail();
  const booking = await prisma.booking.findUnique({ where: { id: fulfillment.bookingId } });
  if (!booking) {
    return {
      status: 'error',
      code: 'booking_not_found',
      message: 'We could not load your booking.',
    };
  }
  return {
    status: 'confirmed',
    booking: {
      id: booking.id,
      fullName: booking.fullName,
      email: booking.email,
      phone: booking.phone,
      addressLine1: booking.addressLine1,
      addressLine2: booking.addressLine2,
      city: booking.city,
      state: booking.state,
      zip: booking.zip,
      serviceDate: toDateOnly(booking.serviceDate),
      summary: summaryFromStored(booking),
    },
    payment: {
      amountCents: fulfillment.amountCents,
      displayAmount: formatAmount(fulfillment.amountCents),
      customerEmail: verification.payment.customer_email ?? null,
      paidAt: fulfillment.paidAt?.toISOString() ?? verification.payment.paid_at ?? null,
    },
  };
}
