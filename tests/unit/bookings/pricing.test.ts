// @polsia:user-owned — booking pricing regression coverage.
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import {
  BOOKING_ADD_ONS,
  calculateBookingQuote,
  classifyBookingArea,
  getBookingOptions,
  INITIAL_BASELINE_CENTS,
  PRICE_MATRIX_CENTS,
  RECURRING_BASELINE_CENTS,
} from '@/lib/business/bookings';
import { BookingQuoteRequest, BookingQuoteResponse } from '@/lib/contracts/bookings';

vi.mock('server-only', () => ({}));

const residential = {
  zip: '79401',
  city: 'Lubbock',
  state: 'TX',
  bedrooms: 2,
  bathrooms: 2,
  addOnSelections: [],
};

const launchPrices = {
  dishes: 2500,
  insideMicrowave: 1500,
  insideOven: 5000,
  insideFridge: 5000,
  baseboardDetail: 6000,
  lightWallSpotCleaning: 3000,
  additionalBathroom: 3500,
  bedMaking: 2000,
  interiorWindows: 1000,
  blinds: 1000,
  insideKitchenCabinets: 6000,
  laundry: 3000,
  petHairHeavyBuildup: 5000,
} as const;

describe('Mintbloom booking pricing', () => {
  it('publishes every Mintbloom launch price, unit, cap, scope, and exception reason', () => {
    const options = getBookingOptions();
    expect(options.addOns).toHaveLength(13);
    expect(options.addOns.map((addOn) => addOn.id)).toEqual(Object.keys(launchPrices));
    for (const addOn of options.addOns) {
      expect(addOn.pricingStatus).toBe('starting_price');
      expect(addOn.priceCents).toBeNull();
      expect(addOn.startingPriceCents).toBe(launchPrices[addOn.id as keyof typeof launchPrices]);
      expect(addOn.displayPrice).toContain('$');
      expect(addOn.maxQuantity).toBeGreaterThanOrEqual(addOn.minQuantity);
      expect(addOn.scope.length).toBeGreaterThan(10);
      expect(addOn.quoteReason.length).toBeGreaterThan(10);
    }
  });

  it('uses the approved initial baseline for a one-time clean', () => {
    const quote = calculateBookingQuote({ ...residential, serviceType: 'oneTimeResidential' });
    expect(quote.status).toBe('quote_required');
    if (quote.status !== 'quote_required') return;
    expect(quote.summary.baseAmountCents).toBe(INITIAL_BASELINE_CENTS);
    expect(quote.summary.totalAmountCents).toBe(18500);
    expect(quote.summary.totalDisplayAmount).toBe('Starting at $185.00');
    expect(BookingQuoteResponse.safeParse(quote).success).toBe(true);
  });

  it('keeps the approved recurring matrix and saved baseline', () => {
    const quote = calculateBookingQuote({
      ...residential,
      serviceType: 'recurringResidential',
      cadence: 'biweekly',
    });
    expect(RECURRING_BASELINE_CENTS).toBe(13500);
    expect(quote.status).toBe('quote_required');
    if (quote.status !== 'quote_required') return;
    expect(quote.summary.baseAmountCents).toBe(PRICE_MATRIX_CENTS.biweekly[2][2]);
    expect(quote.summary.baseAmountCents).toBe(16900);
  });

  it('calculates fixed add-ons in integer cents and carries their metadata', () => {
    const quote = calculateBookingQuote({
      ...residential,
      serviceType: 'oneTimeResidential',
      addOnSelections: [
        { id: 'laundry', quantity: 2 },
        { id: 'insideOven', quantity: 1 },
      ],
    });
    expect(quote.status).toBe('quote_required');
    if (quote.status !== 'quote_required') return;
    expect(quote.summary.totalAmountCents).toBe(18500 + 2 * 3000 + 5000);
    expect(quote.summary.selectedAddOns.map((line) => line.amountCents)).toEqual([6000, 5000]);
    expect(quote.summary.selectedAddOns[0]?.scope).toContain('standard loads');
    expect(quote.summary.selectedAddOns[0]?.quoteReason).toContain('stain treatment');
    expect(quote.summary.selectedAddOns[1]?.unitLabel).toBe('oven');
  });

  it('does not double-charge bathrooms already covered by the base service', () => {
    const quote = calculateBookingQuote({
      ...residential,
      serviceType: 'oneTimeResidential',
      addOnSelections: [{ id: 'additionalBathroom', quantity: 1 }],
    });
    expect(quote.status).toBe('quote_required');
    if (quote.status !== 'quote_required') return;
    expect(quote.summary.baseAmountCents).toBe(INITIAL_BASELINE_CENTS);
    expect(quote.summary.totalAmountCents).toBe(INITIAL_BASELINE_CENTS + 3500);
    expect(quote.summary.selectedAddOns[0]?.unitLabel).toBe('additional bathroom');
  });

  it('classifies Lubbock core, nearby, and unknown locations server-side', () => {
    expect(classifyBookingArea({ zip: '79401', state: 'TX' })).toBe('core');
    expect(classifyBookingArea({ zip: '79382', state: 'TX' })).toBe('nearby');
    expect(classifyBookingArea({ zip: '78701', state: 'TX' })).toBe('extended');
  });

  it('keeps recurring service outside the approved area quote-required for travel', () => {
    const quote = calculateBookingQuote({
      ...residential,
      zip: '78701',
      serviceType: 'recurringResidential',
      cadence: 'monthly',
    });
    expect(quote.status).toBe('quote_required');
    if (quote.status !== 'quote_required') return;
    expect(quote.reason).toContain('distance');
    expect(quote.reason).toContain('approved Lubbock');
  });

  it('keeps specialty services quote-required with concrete dependencies', () => {
    const cases = [
      ['deepCleaning', 'condition'],
      ['moveInMoveOut', 'space size'],
      ['officeCommercial', 'operating hours'],
    ] as const;
    for (const [serviceType, dependency] of cases) {
      const quote = calculateBookingQuote({ ...residential, serviceType });
      expect(quote.status).toBe('quote_required');
      if (quote.status !== 'quote_required') continue;
      expect(quote.reason).toContain(dependency);
      expect(quote.summary.totalDisplayAmount).toBe('Quote required');
    }
  });

  it('keeps specialty landing services quote-required with concrete reasons', () => {
    const cases = [
      ['postConstruction', 'residue'],
      ['medicalGradeSanitation', 'human review'],
    ] as const;
    for (const [serviceType, dependency] of cases) {
      const quote = calculateBookingQuote({ ...residential, serviceType });
      expect(quote.status).toBe('quote_required');
      if (quote.status !== 'quote_required') continue;
      expect(quote.reason.toLowerCase()).toContain(dependency);
      expect(quote.summary.totalDisplayAmount).toBe('Quote required');
      expect(quote.summary.lines.some((line) => line.pricingStatus === 'quote_required')).toBe(
        true,
      );
    }
  });

  it('turns quantities beyond fixed add-on caps into concrete quote-required boundaries', () => {
    const laundry = calculateBookingQuote({
      ...residential,
      serviceType: 'oneTimeResidential',
      addOnSelections: [{ id: 'laundry', quantity: 6 }],
    });
    expect(laundry.status).toBe('quote_required');
    if (laundry.status !== 'quote_required') return;
    expect(laundry.reason).toContain('more than 5');
    expect(laundry.summary.selectedAddOns[0]?.displayAmount).toBe('Quote required');

    const cabinets = calculateBookingQuote({
      ...residential,
      serviceType: 'oneTimeResidential',
      addOnSelections: [{ id: 'insideKitchenCabinets', quantity: 2 }],
    });
    expect(cabinets.status).toBe('quote_required');
    if (cabinets.status !== 'quote_required') return;
    expect(cabinets.reason).toContain('more than 12 sections');
    expect(
      BookingQuoteRequest.safeParse({
        ...residential,
        serviceType: 'oneTimeResidential',
        addOnSelections: [
          { id: 'laundry', quantity: 1 },
          { id: 'laundry', quantity: 2 },
        ],
      }).success,
    ).toBe(false);
  });

  it('keeps one-time residential service cadence-free', () => {
    expect(
      BookingQuoteRequest.safeParse({
        ...residential,
        serviceType: 'oneTimeResidential',
        cadence: 'monthly',
      }).success,
    ).toBe(false);
  });

  it('keeps the catalog source aligned with the published option count', () => {
    expect(BOOKING_ADD_ONS).toHaveLength(13);
    expect(getBookingOptions().addOns.map((addOn) => addOn.id)).toEqual(
      BOOKING_ADD_ONS.map((addOn) => addOn.id),
    );
  });
});
