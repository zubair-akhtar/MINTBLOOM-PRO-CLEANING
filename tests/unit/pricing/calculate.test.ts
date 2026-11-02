// @polsia:user-owned — focused v3 pricing samples and quote-gate regressions.
import { describe, expect, it } from 'vitest';
import { calculateEstimate } from '@/lib/business/pricing/calculate';
import { defaultPricingSettings } from '@/lib/business/pricing/defaults';
import type { EstimateInput } from '@/lib/contracts/pricing';

const base = (overrides: Partial<EstimateInput> = {}): EstimateInput => ({
  service: 'standard',
  squareFeet: 500,
  bedrooms: 0,
  fullBaths: 1,
  halfBaths: 0,
  kitchens: 1,
  offices: 0,
  extraRooms: 0,
  condition: 'routine',
  highWork: false,
  heavyConditionApproved: false,
  cadence: null,
  returningRecurring: false,
  ovenCavities: 0,
  refrigeratorCount: 0,
  cabinetDoors: 0,
  baseboards: false,
  windowPanes: 0,
  windowTracks: 0,
  blinds: 0,
  linenBeds: 0,
  laundryLoads: 0,
  dishBlocks: 0,
  garageBays: 0,
  petHair: false,
  rush: false,
  travelMiles: 0,
  city: 'Lubbock',
  state: 'TX',
  ...overrides,
});

describe('Mintbloom v3 calculator samples', () => {
  it('prices a 500 sq ft studio Standard at $145 before tax', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, base({ fullBaths: 0 }));
    expect(estimate.status).toBe('priced');
    expect(estimate.coreCents).toBe(14500);
    expect(estimate.subtotalCents).toBe(14500);
  });

  it('prices the 601st sq ft at $0.08', () => {
    const estimate = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ squareFeet: 601, fullBaths: 0 }),
    );
    expect(estimate.coreCents).toBe(14508);
  });

  it('prices a 1,200 sq ft 2-bedroom/2-bath Standard at $268 before add-ons', () => {
    const estimate = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ squareFeet: 1200, bedrooms: 2, fullBaths: 2 }),
    );
    expect(estimate.coreCents).toBe(26800);
  });

  it('adds one oven and one refrigerator to the $268 Standard estimate', () => {
    const estimate = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ squareFeet: 1200, bedrooms: 2, fullBaths: 2, ovenCavities: 1, refrigeratorCount: 1 }),
    );
    expect(estimate.subtotalCents).toBe(37300);
  });

  it('charges baseboards per started 1,000 sq ft block', () => {
    const at1000 = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ squareFeet: 1000, fullBaths: 0, baseboards: true }),
    );
    const at1001 = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ squareFeet: 1001, fullBaths: 0, baseboards: true }),
    );
    expect(at1000.lines.find((line) => line.id === 'baseboards')?.amountCents).toBe(4000);
    expect(at1001.lines.find((line) => line.id === 'baseboards')?.amountCents).toBe(8000);
  });

  it.each(['commercial', 'postConstruction'] as const)(
    'keeps %s behind a quote gate without publishing a total',
    (service) => {
      const estimate = calculateEstimate(1, defaultPricingSettings, base({ service }));
      expect(estimate.status).toBe('quote_required');
      expect(estimate.totalCents).toBeNull();
    },
  );

  it('includes one Move oven and refrigerator at $0', () => {
    const estimate = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ service: 'move', ovenCavities: 1, refrigeratorCount: 1 }),
    );
    expect(estimate.lines.find((line) => line.id === 'oven-included')).toMatchObject({
      label: 'Oven interior (one included)',
      amountCents: 0,
      included: true,
    });
    expect(estimate.lines.find((line) => line.id === 'refrigerator')).toMatchObject({
      label: 'Refrigerator interior (included)',
      amountCents: 0,
      included: true,
    });
    expect(estimate.addOnsCents).toBe(0);
  });

  it('charges and labels extra Move appliances, including quantities', () => {
    const oneExtra = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ service: 'move', ovenCavities: 2, refrigeratorCount: 2 }),
    );
    expect(oneExtra.lines.find((line) => line.id === 'oven-extra')).toMatchObject({
      label: 'Oven interior (extra)',
      amountCents: 6000,
    });
    expect(oneExtra.lines.find((line) => line.id === 'refrigerator-extra')).toMatchObject({
      label: 'Refrigerator interior (extra)',
      amountCents: 4500,
    });

    const multipleExtras = calculateEstimate(
      1,
      defaultPricingSettings,
      base({ service: 'move', ovenCavities: 3, refrigeratorCount: 3 }),
    );
    expect(multipleExtras.lines.find((line) => line.id === 'oven-extra')).toMatchObject({
      label: 'Oven interior (extra) ×2',
      amountCents: 12000,
    });
    expect(multipleExtras.lines.find((line) => line.id === 'refrigerator-extra')).toMatchObject({
      label: 'Refrigerator interior (extra) ×2',
      amountCents: 9000,
    });
  });
});
