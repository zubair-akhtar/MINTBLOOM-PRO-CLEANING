// @polsia:user-owned — quote-only Mintbloom v3 pricing calculation.

import { formatUsdFromCents, roundHalfUp } from '@/lib/business/pricing/money';
import type { EstimateInput, EstimateResponse, PricingSettings } from '@/lib/contracts/pricing';

type Line = EstimateResponse['lines'][number];
type PricedService = 'standard' | 'deep' | 'move' | 'airbnb';

function addLine(
  lines: Line[],
  id: string,
  label: string,
  amountCents: number,
  kind: Line['kind'],
  options: { included?: boolean; pending?: boolean } = {},
) {
  lines.push({ id, label, amountCents, kind, ...options });
}

function quoteRequired(
  version: number,
  input: EstimateInput,
  reason: string,
  lines: Line[] = [],
): EstimateResponse {
  return {
    version,
    service: input.service,
    status: 'quote_required',
    reason,
    totalCents: null,
    coreCents: null,
    discountCents: 0,
    netCents: null,
    heavyCents: 0,
    addOnsCents: 0,
    travelCents: 0,
    subtotalCents: null,
    taxCents: null,
    taxBasisPoints: null,
    lines,
  };
}

function lineSum(lines: Line[]) {
  return lines.reduce((total, line) => total + line.amountCents, 0);
}

export function calculateEstimate(
  version: number,
  settings: PricingSettings,
  input: EstimateInput,
): EstimateResponse {
  if (input.service === 'commercial')
    return quoteRequired(version, input, 'Commercial work needs a walkthrough and a custom quote.');
  if (input.service === 'postConstruction')
    return quoteRequired(
      version,
      input,
      'Post-construction work needs a walkthrough and a custom quote.',
    );
  if (input.service === 'medicalGradeSanitation')
    return quoteRequired(
      version,
      input,
      'Sanitation-focused work needs a walkthrough and a custom quote.',
    );

  const market = settings.markets.find(
    (entry) =>
      entry.city.toLocaleLowerCase('en-US') === input.city.toLocaleLowerCase('en-US') &&
      entry.state.toLocaleUpperCase('en-US') === input.state.toLocaleUpperCase('en-US'),
  );
  const reasons: string[] = [];
  if (!market || !market.isActive) reasons.push('Pricing is not available for this market.');
  else if (!market.pricingEnabled)
    reasons.push('Automated pricing is not enabled for this market.');
  else if (market.taxBasisPoints === null)
    reasons.push('The tax rate for this market needs confirmation.');
  if (input.bedrooms >= 5) reasons.push('Homes with five or more bedrooms need a custom quote.');
  if (input.squareFeet > settings.maxAutoSqFt)
    reasons.push(
      `Homes over ${settings.maxAutoSqFt.toLocaleString('en-US')} square feet need a walkthrough.`,
    );
  const bathEquivalents = input.fullBaths + input.halfBaths / 2;
  if (bathEquivalents > 4)
    reasons.push('Homes with more than four bath equivalents need a custom quote.');
  if (input.kitchens > 1) reasons.push('Homes with more than one kitchen need a custom quote.');
  if (input.condition === 'severe' || input.condition === 'unknown')
    reasons.push('The condition needs an in-person scope review.');
  if (input.highWork) reasons.push('High-work properties need a custom quote.');
  if (input.condition === 'heavy' && !input.heavyConditionApproved)
    reasons.push('The heavy-condition allowance needs approval before pricing.');
  if (input.travelMiles > 50) reasons.push('Travel over 50 miles needs a custom quote.');
  if (input.rush) reasons.push('Rush service is pending confirmation.');
  if (reasons.length > 0) {
    const pendingLines: Line[] = [];
    if (input.rush)
      addLine(
        pendingLines,
        'rush',
        'Rush request (pending confirmation)',
        settings.addOns.rushCents,
        'add_on',
        { pending: true },
      );
    return quoteRequired(version, input, reasons.join(' '), pendingLines);
  }

  const service = input.service as PricedService;
  const rate = settings.services[service];
  const lines: Line[] = [];
  addLine(lines, 'base', `${serviceLabel(service)} base`, rate.baseCents, 'core');

  const additionalSquareFeet = Math.max(0, input.squareFeet - settings.includedSqFt);
  if (additionalSquareFeet > 0)
    addLine(
      lines,
      'area',
      `Additional area (${additionalSquareFeet.toLocaleString('en-US')} sq ft)`,
      additionalSquareFeet * settings.areaCentsPerSqFt[service],
      'core',
    );
  if (input.bedrooms > 0)
    addLine(
      lines,
      'bedrooms',
      `Bedrooms (${input.bedrooms})`,
      input.bedrooms * settings.bedroomCents[service],
      'core',
    );
  const bathEquivalentsTwice = Math.max(0, input.fullBaths * 2 + input.halfBaths - 2);
  if (bathEquivalentsTwice > 0)
    addLine(
      lines,
      'bathrooms',
      `Extra bath equivalents (${formatHalfUnits(bathEquivalentsTwice)})`,
      roundHalfUp(bathEquivalentsTwice * settings.bathEquivalentCents[service], 2),
      'core',
    );
  if (input.offices > 0)
    addLine(
      lines,
      'offices',
      `Office (${input.offices})`,
      input.offices * settings.officeCents[service],
      'core',
    );
  if (input.extraRooms > 0)
    addLine(
      lines,
      'extra-rooms',
      `Extra living or bonus rooms (${input.extraRooms})`,
      input.extraRooms * settings.extraRoomCents[service],
      'core',
    );

  const coreCents = lineSum(lines);
  const discountBasisPoints =
    service === 'standard' && input.cadence && input.returningRecurring
      ? settings.recurringDiscountBasisPoints[input.cadence]
      : 0;
  const discountCents = roundHalfUp(coreCents * discountBasisPoints, 10_000);
  const afterDiscount = coreCents - discountCents;
  const netCents = Math.max(afterDiscount, rate.minimumCents);
  if (discountCents > 0)
    addLine(lines, 'recurring-discount', 'Recurring visit discount', discountCents, 'discount');
  if (netCents > afterDiscount)
    addLine(
      lines,
      'minimum-adjustment',
      'Service minimum adjustment',
      netCents - afterDiscount,
      'core',
    );

  const heavyCents =
    input.condition === 'heavy' && input.heavyConditionApproved
      ? roundHalfUp(coreCents * settings.addOns.heavyConditionBasisPoints, 10_000)
      : 0;
  if (heavyCents > 0)
    addLine(lines, 'heavy-condition', 'Approved heavy-condition allowance', heavyCents, 'heavy');

  const addOnStart = lines.length;
  const addOns = settings.addOns;
  if (service === 'move') {
    const extraOvens = Math.max(0, input.ovenCavities - 1);
    const extraRefrigerators = Math.max(0, input.refrigeratorCount - 1);
    addLine(lines, 'oven-included', 'Oven interior (one included)', 0, 'add_on', {
      included: true,
    });
    if (extraOvens > 0)
      addLine(
        lines,
        'oven-extra',
        extraOvens > 1 ? `Oven interior (extra) ×${extraOvens}` : 'Oven interior (extra)',
        extraOvens * addOns.ovenCents,
        'add_on',
      );
    addLine(lines, 'refrigerator', 'Refrigerator interior (included)', 0, 'add_on', {
      included: true,
    });
    if (extraRefrigerators > 0)
      addLine(
        lines,
        'refrigerator-extra',
        extraRefrigerators > 1
          ? `Refrigerator interior (extra) ×${extraRefrigerators}`
          : 'Refrigerator interior (extra)',
        extraRefrigerators * addOns.refrigeratorCents,
        'add_on',
      );
    addLine(lines, 'cabinets', 'Cabinet interiors (included)', 0, 'add_on', { included: true });
  } else {
    if (input.ovenCavities > 0)
      addLine(lines, 'oven', 'Oven interior', input.ovenCavities * addOns.ovenCents, 'add_on');
    if (input.refrigeratorCount > 0)
      addLine(
        lines,
        'refrigerator',
        'Refrigerator interior',
        input.refrigeratorCount * addOns.refrigeratorCents,
        'add_on',
      );
    if (input.cabinetDoors > 0) {
      const extraDoors = Math.max(0, input.cabinetDoors - addOns.cabinetIncludedDoors);
      const cabinetCents = addOns.cabinetBaseCents + extraDoors * addOns.cabinetExtraDoorCents;
      addLine(lines, 'cabinets', 'Cabinet interiors', cabinetCents, 'add_on');
    }
  }

  if (input.windowPanes > 0)
    addLine(
      lines,
      'windows',
      `Interior windows (${input.windowPanes} panes)`,
      Math.max(addOns.windowMinimumCents, input.windowPanes * addOns.windowPaneCents),
      'add_on',
    );
  if (input.windowTracks > 0)
    addLine(
      lines,
      'window-tracks',
      `Window tracks (${input.windowTracks})`,
      input.windowTracks * addOns.windowTrackCents,
      'add_on',
    );
  if (input.blinds > 0)
    addLine(
      lines,
      'blinds',
      `Blinds (${input.blinds})`,
      input.blinds * addOns.blindCents,
      'add_on',
    );

  const baseboardsIncluded = service === 'deep' || service === 'move';
  const baseboardCents = baseboardsIncluded
    ? 0
    : input.baseboards
      ? Math.ceil(input.squareFeet / 1_000) * addOns.baseboardsPerStarted1000Cents
      : 0;
  if (baseboardsIncluded)
    addLine(lines, 'baseboards', 'Baseboards (included)', 0, 'add_on', { included: true });
  else if (baseboardCents > 0) addLine(lines, 'baseboards', 'Baseboards', baseboardCents, 'add_on');

  if (input.linenBeds > 0) {
    const linenChargeableBeds =
      service === 'airbnb'
        ? Math.max(0, input.linenBeds - addOns.airbnbIncludedLinenBeds)
        : input.linenBeds;
    const linenRate = service === 'airbnb' ? addOns.airbnbExtraLinenCents : addOns.linenCents;
    addLine(
      lines,
      'linen',
      service === 'airbnb' ? 'Linen changes (additional beds)' : 'Linen changes',
      linenChargeableBeds * linenRate,
      'add_on',
      linenChargeableBeds === 0 ? { included: true } : {},
    );
  }
  if (input.laundryLoads > 0)
    addLine(
      lines,
      'laundry',
      `Laundry (${input.laundryLoads} loads)`,
      input.laundryLoads * addOns.laundryPerLoadCents,
      'add_on',
    );
  if (input.dishBlocks > 0)
    addLine(
      lines,
      'dishes',
      `Dishes (${input.dishBlocks} × 15-minute blocks)`,
      input.dishBlocks * addOns.dishesPerBlockCents,
      'add_on',
    );
  if (input.garageBays > 0)
    addLine(
      lines,
      'garage',
      `Garage (${input.garageBays} bays)`,
      input.garageBays * addOns.garageBayCents,
      'add_on',
    );
  if (input.petHair) addLine(lines, 'pet-hair', 'Pet hair', addOns.petHairCents, 'add_on');
  if (input.rush)
    addLine(lines, 'rush', 'Rush request (pending confirmation)', addOns.rushCents, 'add_on', {
      pending: true,
    });

  const addOnsCents = lineSum(lines.slice(addOnStart));
  let travelCents = 0;
  if (input.travelMiles > 35) travelCents = 6_000;
  else if (input.travelMiles > 20) travelCents = 3_000;
  addLine(
    lines,
    'travel',
    input.travelMiles <= 20 ? 'Travel (within 20 miles)' : 'Travel',
    travelCents,
    'travel',
  );

  const subtotalCents = netCents + heavyCents + addOnsCents + travelCents;
  addLine(lines, 'subtotal', 'Subtotal', subtotalCents, 'subtotal');
  const taxBasisPoints = market?.taxBasisPoints ?? 0;
  const taxCents = roundHalfUp(subtotalCents * taxBasisPoints, 10_000);
  addLine(lines, 'tax', `Market tax (${(taxBasisPoints / 100).toFixed(2)}%)`, taxCents, 'tax');
  const totalCents = subtotalCents + taxCents;
  addLine(lines, 'total', 'Total', totalCents, 'total');

  return {
    version,
    service: input.service,
    status: 'priced',
    reason: null,
    totalCents,
    coreCents,
    discountCents,
    netCents,
    heavyCents,
    addOnsCents,
    travelCents,
    subtotalCents,
    taxCents,
    taxBasisPoints,
    lines,
  };
}

function serviceLabel(service: PricedService) {
  return {
    standard: 'Standard cleaning',
    deep: 'Deep cleaning',
    move: 'Move-in / move-out cleaning',
    airbnb: 'Airbnb turnover',
  }[service];
}

function formatHalfUnits(twice: number) {
  return twice % 2 === 0 ? String(twice / 2) : `${Math.floor(twice / 2)}.5`;
}

export function formatEstimateTotal(estimate: EstimateResponse) {
  return estimate.totalCents === null
    ? 'Quote after review'
    : formatUsdFromCents(estimate.totalCents);
}
