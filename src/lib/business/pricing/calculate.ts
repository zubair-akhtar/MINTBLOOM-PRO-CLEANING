// @polsia:user-owned — Mintbloom v3 residential estimate engine.

import { roundCents } from '@/lib/business/pricing/money';
import type {
  CalculatorServiceId,
  EstimateInput,
  EstimateLine,
  EstimateResult,
  PricedServiceId,
  PricingSettings,
} from '@/lib/business/pricing/types';

const PRICED: ReadonlySet<string> = new Set(['standard', 'deep', 'move', 'airbnb']);

export function isPricedService(service: CalculatorServiceId): service is PricedServiceId {
  return PRICED.has(service);
}

export function bathEquivalents(fullBaths: number, halfBaths: number): number {
  return fullBaths + halfBaths * 0.5;
}

function emptyResult(
  service: CalculatorServiceId,
  reasons: string[],
  extras: Partial<EstimateResult> = {},
): EstimateResult {
  return {
    status: 'quote_required',
    reasons,
    service,
    lines: [],
    coreCents: 0,
    discountCents: 0,
    minimumAdjustmentCents: 0,
    netCoreCents: 0,
    extrasCents: 0,
    feesCents: 0,
    subtotalCents: 0,
    taxCents: 0,
    totalCents: 0,
    taxRateBps: extras.taxRateBps ?? null,
    bathEquivalents: extras.bathEquivalents ?? 0,
    ...extras,
  };
}

export function calculateEstimate(input: EstimateInput, settings: PricingSettings): EstimateResult {
  const reasons: string[] = [];
  const baths = bathEquivalents(input.fullBaths, input.halfBaths);

  if (!input.marketPricingEnabled) {
    reasons.push('This market is not enabled for automated estimates. Request a quote.');
  }
  if (input.service === 'commercial') {
    reasons.push('Commercial cleaning requires an onsite walkthrough and written quote.');
  }
  if (input.service === 'postConstruction') {
    reasons.push('Post-construction / builder work requires a walkthrough and written quote.');
  }
  if (input.bedrooms === '5plus' || (typeof input.bedrooms === 'number' && input.bedrooms > settings.maxAutoBedrooms)) {
    reasons.push('Homes with five or more bedrooms need a personalized quote.');
  }
  if (input.squareFeet === null || !Number.isFinite(input.squareFeet) || input.squareFeet <= 0) {
    reasons.push('Exact square footage is required for an automated estimate.');
  }
  if (input.squareFeet !== null && input.squareFeet > settings.maxAutoSqFt) {
    reasons.push(`Homes over ${settings.maxAutoSqFt.toLocaleString()} sq. ft. require a quote.`);
  }
  if (baths > settings.maxAutoBathEquivalents) {
    reasons.push(`More than ${settings.maxAutoBathEquivalents} bath equivalents require a quote.`);
  }
  if (input.kitchens > 1) {
    reasons.push('Multiple kitchens require a customized quote.');
  }
  // Soft review flags — keep a live priced estimate; staff confirms on submit.
  const reviewNotes: string[] = [];
  if (input.severeOrUnknownCondition) {
    reviewNotes.push('Severe or unknown condition will be confirmed by staff.');
  }
  if (input.highWorkRequested) {
    reviewNotes.push('High-surface work will be assessed separately.');
  }
  if (input.travelMiles !== null) {
    const band = resolveTravelBand(input.travelMiles, settings);
    if (band?.quoteRequired) {
      reasons.push('Travel beyond configured distance requires a quote.');
    }
  } else if (input.travelMiles === null && input.service !== 'commercial' && input.service !== 'postConstruction') {
    // Unconfigured distance is review only when explicitly unknown after market OK —
    // launch default: treat null miles as hub-unknown → no travel fee, no gate.
  }

  const laundryQty = input.addOnQuantities.laundry ?? 0;
  if (laundryQty > settings.maxAutoLaundryLoads) {
    reasons.push('More than two laundry loads require review.');
  }
  const dishQty = input.addOnQuantities.dishes ?? 0;
  if (dishQty > settings.maxAutoDishBlocks) {
    reasons.push('Larger dish volume requires review.');
  }
  if (input.service === 'airbnb') {
    const beds = input.addOnQuantities.linenChanges ?? 0;
    if (beds > 6) {
      reasons.push('More than six Airbnb bed changes require review.');
    }
  }

  if (reasons.length > 0 || !isPricedService(input.service)) {
    return emptyResult(input.service, reasons, { bathEquivalents: baths, taxRateBps: input.taxRateBps });
  }

  const row = settings.services[input.service];
  const sqft = input.squareFeet as number;
  const bedroomCount = typeof input.bedrooms === 'number' ? input.bedrooms : 0;

  const sizeCharge = roundCents(Math.max(0, sqft - settings.includedSqFt) * row.areaRateCentsPerSqFt);
  const bedroomCharge = bedroomCount * row.bedroomCents;
  const extraBaths = Math.max(0, baths - 1);
  const bathCharge = roundCents(extraBaths * row.bathCents);
  const officeCharge = input.offices * row.officeCents;
  const livingCharge = input.extraLivingRooms * row.extraLivingCents;

  const coreCents =
    row.baseCents + sizeCharge + bedroomCharge + bathCharge + officeCharge + livingCharge;

  const lines: EstimateLine[] = [
    { id: 'base', label: 'Base (includes first 600 sq. ft.)', amountCents: row.baseCents, taxable: true },
  ];
  if (sizeCharge > 0) {
    lines.push({
      id: 'size',
      label: `Size (${(sqft - settings.includedSqFt).toLocaleString()} sq. ft. above ${settings.includedSqFt})`,
      amountCents: sizeCharge,
      taxable: true,
    });
  }
  if (bedroomCharge > 0) {
    lines.push({
      id: 'bedrooms',
      label: `Bedrooms (${bedroomCount})`,
      amountCents: bedroomCharge,
      taxable: true,
    });
  }
  if (bathCharge > 0) {
    lines.push({
      id: 'baths',
      label: `Additional bathrooms (${extraBaths} eq.)`,
      amountCents: bathCharge,
      taxable: true,
    });
  }
  if (officeCharge > 0) {
    lines.push({
      id: 'offices',
      label: `Offices / studies (${input.offices})`,
      amountCents: officeCharge,
      taxable: true,
    });
  }
  if (livingCharge > 0) {
    lines.push({
      id: 'living',
      label: `Extra living / bonus rooms (${input.extraLivingRooms})`,
      amountCents: livingCharge,
      taxable: true,
    });
  }

  let discountCents = 0;
  const eligibleRecurring =
    input.service === 'standard' &&
    !input.isFirstRecurringVisit &&
    (input.cadence === 'weekly' || input.cadence === 'biweekly' || input.cadence === 'monthly');
  if (eligibleRecurring && input.cadence !== 'one_time') {
    const pct = settings.recurringDiscounts[input.cadence];
    discountCents = roundCents(coreCents * pct);
    lines.push({
      id: 'discount',
      label: `${input.cadence} recurring discount (${Math.round(pct * 100)}%)`,
      amountCents: -discountCents,
      taxable: true,
    });
  }

  const afterDiscount = coreCents - discountCents;
  const netCoreCents = Math.max(afterDiscount, row.minimumCents);
  const minimumAdjustmentCents = netCoreCents - afterDiscount;
  if (minimumAdjustmentCents > 0) {
    lines.push({
      id: 'minimum',
      label: 'Minimum booking adjustment',
      amountCents: minimumAdjustmentCents,
      taxable: true,
    });
  }

  let feesCents = 0;
  let extrasCents = 0;

  if (input.heavyConditionApproved) {
    const heavy = roundCents(coreCents * settings.heavyConditionPercentOfCore);
    feesCents += heavy;
    lines.push({
      id: 'heavy',
      label: 'Approved heavy-condition adjustment',
      amountCents: heavy,
      taxable: true,
    });
  }

  if (input.petHairNeeded) {
    feesCents += settings.petHairCents;
    lines.push({
      id: 'petHair',
      label: 'Pet hair extra work',
      amountCents: settings.petHairCents,
      taxable: true,
    });
  }

  if (input.rushRequested) {
    feesCents += settings.rushFeeCents;
    lines.push({
      id: 'rush',
      label: 'Rush (pending staff confirmation)',
      amountCents: settings.rushFeeCents,
      taxable: true,
    });
  }

  if (input.travelMiles !== null) {
    const band = resolveTravelBand(input.travelMiles, settings);
    if (band && band.feeCents > 0 && !band.quoteRequired) {
      feesCents += band.feeCents;
      lines.push({
        id: 'travel',
        label: 'Travel fee',
        amountCents: band.feeCents,
        taxable: true,
      });
    }
  }

  const addonExtra = priceAddOns(input, settings, lines);
  extrasCents += addonExtra;

  const subtotalCents = netCoreCents + feesCents + extrasCents;

  let taxCents = 0;
  if (input.taxRateBps === null) {
    reasons.push('Tax rate is not configured for this market; billing held for review.');
    return {
      status: 'quote_required',
      reasons,
      service: input.service,
      lines,
      coreCents,
      discountCents,
      minimumAdjustmentCents,
      netCoreCents,
      extrasCents,
      feesCents,
      subtotalCents,
      taxCents: 0,
      totalCents: 0,
      taxRateBps: null,
      bathEquivalents: baths,
    };
  }

  const taxable = lines.filter((l) => l.taxable).reduce((sum, l) => sum + l.amountCents, 0);
  taxCents = roundCents((Math.max(0, taxable) * input.taxRateBps) / 10000);
  lines.push({
    id: 'tax',
    label: `Sales tax (${(input.taxRateBps / 100).toFixed(2)}%)`,
    amountCents: taxCents,
    taxable: false,
  });

  return {
    status: 'priced',
    reasons: reviewNotes,
    service: input.service,
    lines,
    coreCents,
    discountCents,
    minimumAdjustmentCents,
    netCoreCents,
    extrasCents,
    feesCents,
    subtotalCents,
    taxCents,
    totalCents: subtotalCents + taxCents,
    taxRateBps: input.taxRateBps,
    bathEquivalents: baths,
  };
}

function resolveTravelBand(miles: number, settings: PricingSettings) {
  for (const band of settings.travelBands) {
    if (band.maxMilesInclusive === null) return band;
    if (miles <= band.maxMilesInclusive) return band;
  }
  return settings.travelBands[settings.travelBands.length - 1];
}

function priceAddOns(
  input: EstimateInput,
  settings: PricingSettings,
  lines: EstimateLine[],
): number {
  let total = 0;
  const service = input.service as PricedServiceId;
  const qty = input.addOnQuantities;

  // Baseboards: Standard/Airbnb charge per started 1000 sq ft; Deep/Move included.
  const baseboardIncluded = service === 'deep' || service === 'move';
  if (baseboardIncluded) {
    lines.push({
      id: 'baseboards-included',
      label: 'Hand-wiped baseboards',
      amountCents: 0,
      taxable: true,
    });
  } else if ((qty.baseboards ?? 0) > 0 && input.squareFeet) {
    const blocks = Math.ceil(input.squareFeet / 1000);
    const amount = blocks * settings.baseboardsPerStartedThousandCents;
    total += amount;
    lines.push({
      id: 'baseboards',
      label: `Hand-wiped baseboards (${blocks}×1,000 sq. ft.)`,
      amountCents: amount,
      taxable: true,
    });
  }

  const ovenQty = qty.oven ?? 0;
  const fridgeQty = qty.fridge ?? 0;
  const cabinetQty = qty.cabinets ?? 0;
  const moveIncluded = service === 'move';

  if (moveIncluded) {
    lines.push({ id: 'oven-included', label: 'Oven interior (1 included)', amountCents: 0, taxable: true });
    lines.push({
      id: 'fridge-included',
      label: 'Refrigerator interior (1 included)',
      amountCents: 0,
      taxable: true,
    });
    lines.push({
      id: 'cabinets-included',
      label: 'Empty cabinet interiors (included)',
      amountCents: 0,
      taxable: true,
    });
  }

  const ovenRate = settings.addOns.find((a) => a.id === 'oven')?.unitCents ?? 6000;
  const fridgeRate = settings.addOns.find((a) => a.id === 'fridge')?.unitCents ?? 4500;

  const billableOvens = moveIncluded ? Math.max(0, ovenQty - 1) : ovenQty;
  if (billableOvens > 0) {
    const amount = billableOvens * ovenRate;
    total += amount;
    lines.push({
      id: 'oven',
      label: `Oven interior (${billableOvens})`,
      amountCents: amount,
      taxable: true,
    });
  }

  const billableFridges = moveIncluded ? Math.max(0, fridgeQty - 1) : fridgeQty;
  if (billableFridges > 0) {
    const amount = billableFridges * fridgeRate;
    total += amount;
    lines.push({
      id: 'fridge',
      label: `Refrigerator interior (${billableFridges})`,
      amountCents: amount,
      taxable: true,
    });
  }

  // Cabinets: $60 up to 20 doors, then $3 each; Move includes base set once.
  if (!moveIncluded && cabinetQty > 0) {
    const doors = cabinetQty;
    const amount =
      settings.cabinetInteriorBaseCents +
      Math.max(0, doors - settings.cabinetInteriorIncludedDoors) * settings.cabinetInteriorExtraDoorCents;
    total += amount;
    lines.push({
      id: 'cabinets',
      label: `Empty cabinet interiors (${doors} doors/drawers)`,
      amountCents: amount,
      taxable: true,
    });
  } else if (moveIncluded && cabinetQty > settings.cabinetInteriorIncludedDoors) {
    const extra = cabinetQty - settings.cabinetInteriorIncludedDoors;
    const amount = extra * settings.cabinetInteriorExtraDoorCents;
    total += amount;
    lines.push({
      id: 'cabinets-extra',
      label: `Extra cabinet doors/drawers (${extra})`,
      amountCents: amount,
      taxable: true,
    });
  }

  const panes = qty.interiorWindows ?? 0;
  if (panes > 0) {
    const amount = Math.max(settings.windowPaneCents * panes, 4000);
    total += amount;
    lines.push({
      id: 'interiorWindows',
      label: `Interior window glass (${panes} panes)`,
      amountCents: amount,
      taxable: true,
    });
  }

  const tracks = qty.windowTracks ?? 0;
  if (tracks > 0) {
    const amount = tracks * settings.windowTracksCents;
    total += amount;
    lines.push({
      id: 'windowTracks',
      label: `Window tracks (${tracks})`,
      amountCents: amount,
      taxable: true,
    });
  }

  const blinds = qty.blinds ?? 0;
  if (blinds > 0) {
    const amount = blinds * settings.blindCents;
    total += amount;
    lines.push({
      id: 'blinds',
      label: `Blinds (${blinds})`,
      amountCents: amount,
      taxable: true,
    });
  }

  let linenBeds = qty.linenChanges ?? 0;
  if (service === 'airbnb') {
    const included = settings.airbnbIncludedBedChanges;
    lines.push({
      id: 'linen-included',
      label: `Bed linen changes (${included} included)`,
      amountCents: 0,
      taxable: true,
    });
    const extra = Math.max(0, linenBeds - included);
    if (extra > 0) {
      const amount = extra * settings.airbnbExtraBedChangeCents;
      total += amount;
      lines.push({
        id: 'linenChanges',
        label: `Additional bed changes (${extra})`,
        amountCents: amount,
        taxable: true,
      });
    }
  } else if (linenBeds > 0) {
    const amount = linenBeds * settings.linenChangeCents;
    total += amount;
    lines.push({
      id: 'linenChanges',
      label: `Linen / bed changes (${linenBeds})`,
      amountCents: amount,
      taxable: true,
    });
  }

  const laundry = qty.laundry ?? 0;
  if (laundry > 0) {
    const amount = laundry * settings.laundryLoadCents;
    total += amount;
    lines.push({
      id: 'laundry',
      label: `Onsite laundry (${laundry} loads)`,
      amountCents: amount,
      taxable: true,
    });
  }

  const dishes = qty.dishes ?? 0;
  if (dishes > 0) {
    const amount = dishes * settings.dishesBlockCents;
    total += amount;
    lines.push({
      id: 'dishes',
      label: `Dishes (${dishes}×15 min)`,
      amountCents: amount,
      taxable: true,
    });
  }

  const garage = qty.garage ?? 0;
  if (garage > 0) {
    const amount = garage * settings.garageBayCents;
    total += amount;
    lines.push({
      id: 'garage',
      label: `Garage sweep (${garage} bays)`,
      amountCents: amount,
      taxable: true,
    });
  }

  return total;
}
