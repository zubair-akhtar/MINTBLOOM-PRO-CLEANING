import { describe, expect, it } from 'vitest';
import { BookingQuoteRequest, BookingQuoteResponse } from '@/lib/contracts/bookings';

const summary = {
  serviceType: 'oneTimeResidential' as const,
  serviceLabel: 'One-time residential clean',
  cadence: null,
  cadenceLabel: null,
  inclusions: ['Kitchen surfaces'],
  exclusions: ['Exterior windows'],
  selectedAddOns: [],
  pricingStatus: 'starting_price' as const,
  baseAmountCents: 18500,
  travelChargeCents: 0,
  travelPricingStatus: 'approved' as const,
  totalAmountCents: 18500,
  baseDisplayAmount: 'Starting at $185.00',
  travelDisplayAmount: '$0.00',
  totalDisplayAmount: 'Starting at $185.00',
  areaClassification: 'core' as const,
  lines: [
    {
      id: 'service',
      label: 'One-time residential clean',
      amountCents: 18500,
      displayAmount: 'Starting at $185.00',
      quantity: 1,
      unitLabel: 'service',
      pricingStatus: 'starting_price' as const,
      scope: null,
      quoteReason: null,
    },
  ],
};

const request = {
  zip: '79401',
  city: 'Lubbock',
  state: 'TX',
  bedrooms: 2,
  bathrooms: 1,
  serviceType: 'oneTimeResidential' as const,
  addOnSelections: [],
};

describe('booking quote contract', () => {
  it('keeps a starting price separate from a final charge', () => {
    expect(BookingQuoteResponse.safeParse({ status: 'priced', summary }).success).toBe(true);
    expect(
      BookingQuoteResponse.safeParse({
        status: 'quote_required',
        summary,
        reason: 'Final pricing follows human review.',
      }).success,
    ).toBe(true);
  });

  it('requires a reason for quote-required responses', () => {
    expect(BookingQuoteResponse.safeParse({ status: 'quote_required', summary }).success).toBe(
      false,
    );
    expect(
      BookingQuoteResponse.safeParse({ status: 'quote_required', summary, reason: 'Needs review.' })
        .success,
    ).toBe(true);
  });

  it('accepts deep cleaning and quantity-aware quote lines', () => {
    const result = BookingQuoteResponse.safeParse({
      status: 'quote_required',
      reason: 'Deep cleaning needs a scope review.',
      summary: {
        ...summary,
        serviceType: 'deepCleaning',
        serviceLabel: 'Deep cleaning',
        pricingStatus: 'quote_required',
        selectedAddOns: [
          {
            id: 'laundry',
            label: 'Laundry wash / dry / fold',
            quantity: 2,
            unitLabel: 'load',
            amountCents: 0,
            displayAmount: 'Quote required',
            pricingStatus: 'quote_required',
            scope: '1–5 standard loads washed, dried, and folded.',
            quoteReason: 'Quote required for stain treatment or more than 5.',
          },
        ],
      },
    });
    expect(result.success).toBe(true);
  });

  it('accepts the specialty service values and quote-required response shape', () => {
    for (const serviceType of ['postConstruction', 'medicalGradeSanitation'] as const) {
      expect(
        BookingQuoteRequest.safeParse({
          ...request,
          serviceType,
          scope: 'Review residue, access, and requested sanitation scope.',
        }).success,
      ).toBe(true);
      const result = BookingQuoteResponse.safeParse({
        status: 'quote_required',
        reason: 'Human scope review is required before final pricing.',
        summary: { ...summary, serviceType, pricingStatus: 'quote_required' },
      });
      expect(result.success).toBe(true);
    }
  });
});
