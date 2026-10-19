import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '@/lib/business/pricing/calculate';
import { DEFAULT_PRICING_SETTINGS } from '@/lib/business/pricing/defaults';
import type { EstimateInput } from '@/lib/business/pricing/types';

const base = (overrides: Partial<EstimateInput> = {}): EstimateInput => ({
  service: 'standard',
  squareFeet: 500,
  bedrooms: 0,
  fullBaths: 1,
  halfBaths: 0,
  offices: 0,
  extraLivingRooms: 0,
  kitchens: 1,
  cadence: 'one_time',
  isFirstRecurringVisit: true,
  addOnQuantities: {},
  heavyConditionApproved: false,
  petHairNeeded: false,
  rushRequested: false,
  travelMiles: 5,
  highWorkRequested: false,
  severeOrUnknownCondition: false,
  marketPricingEnabled: true,
  taxRateBps: 825,
  ...overrides,
});

describe('v3 calculateEstimate', () => {
  it('prices a 500 sqft studio standard at $145 before tax', () => {
    const result = calculateEstimate(base(), DEFAULT_PRICING_SETTINGS);
    expect(result.status).toBe('priced');
    expect(result.coreCents).toBe(14500);
    expect(result.subtotalCents).toBe(14500);
    expect(result.taxCents).toBe(1196);
    expect(result.totalCents).toBe(15696);
  });

  it('charges $0.08 for the 601st sq ft', () => {
    const at600 = calculateEstimate(base({ squareFeet: 600, fullBaths: 0 }), DEFAULT_PRICING_SETTINGS);
    const at601 = calculateEstimate(base({ squareFeet: 601, fullBaths: 0 }), DEFAULT_PRICING_SETTINGS);
    expect(at600.coreCents).toBe(14500);
    expect(at601.coreCents).toBe(14508);
  });

  it('matches 2-bed / 2-bath / 1200 sqft standard core $268', () => {
    const result = calculateEstimate(
      base({ squareFeet: 1200, bedrooms: 2, fullBaths: 2 }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.coreCents).toBe(26800);
  });

  it('adds oven and fridge to that home', () => {
    const result = calculateEstimate(
      base({
        squareFeet: 1200,
        bedrooms: 2,
        fullBaths: 2,
        addOnQuantities: { oven: 1, fridge: 1 },
      }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.subtotalCents).toBe(37300);
  });

  it('applies weekly discount then enforces $145 minimum on studio', () => {
    const result = calculateEstimate(
      base({
        cadence: 'weekly',
        isFirstRecurringVisit: false,
        fullBaths: 1,
      }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.discountCents).toBe(1450);
    expect(result.minimumAdjustmentCents).toBe(1450);
    expect(result.netCoreCents).toBe(14500);
  });

  it('includes one oven and fridge in Move at $0', () => {
    const result = calculateEstimate(
      base({
        service: 'move',
        squareFeet: 500,
        bedrooms: 0,
        fullBaths: 1,
        addOnQuantities: { oven: 1, fridge: 1 },
      }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.status).toBe('priced');
    expect(result.extrasCents).toBe(0);
    expect(result.coreCents).toBe(39500);
  });

  it('charges second oven on Move', () => {
    const result = calculateEstimate(
      base({
        service: 'move',
        squareFeet: 500,
        bedrooms: 0,
        fullBaths: 1,
        addOnQuantities: { oven: 2 },
      }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.extrasCents).toBe(6000);
  });

  it('gates 5+ bedrooms to quote_required and clears total', () => {
    const result = calculateEstimate(base({ bedrooms: '5plus' }), DEFAULT_PRICING_SETTINGS);
    expect(result.status).toBe('quote_required');
    expect(result.totalCents).toBe(0);
  });

  it('gates commercial to walkthrough quote', () => {
    const result = calculateEstimate(base({ service: 'commercial' }), DEFAULT_PRICING_SETTINGS);
    expect(result.status).toBe('quote_required');
    expect(result.reasons.some((r) => /walkthrough/i.test(r))).toBe(true);
  });

  it('prices baseboards: 1000 sqft = $40, 1001 = $80 on Standard', () => {
    const a = calculateEstimate(
      base({ squareFeet: 1000, bedrooms: 0, fullBaths: 0, addOnQuantities: { baseboards: 1 } }),
      DEFAULT_PRICING_SETTINGS,
    );
    const b = calculateEstimate(
      base({ squareFeet: 1001, bedrooms: 0, fullBaths: 0, addOnQuantities: { baseboards: 1 } }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(a.extrasCents).toBe(4000);
    expect(b.extrasCents).toBe(8000);
  });

  it('matches 1-bed/1-bath/800 Standard = $181', () => {
    const result = calculateEstimate(
      base({ squareFeet: 800, bedrooms: 1, fullBaths: 1 }),
      DEFAULT_PRICING_SETTINGS,
    );
    expect(result.coreCents).toBe(18100);
  });
});
