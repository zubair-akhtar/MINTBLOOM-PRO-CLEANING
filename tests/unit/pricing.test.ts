// @polsia:user-owned — Mintbloom v3 pricing math and response-cache regressions.
// @vitest-environment node
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { calculateEstimate } from '@/lib/business/pricing/calculate';
import { defaultPricingSettings } from '@/lib/business/pricing/defaults';
import { estimateInputSchema, type EstimateInput } from '@/lib/contracts/pricing';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/business/pricing/store', () => ({
  getActivePricingSettings: vi.fn(),
}));
vi.mock('@/lib/same-origin', () => ({ sameOrigin: vi.fn(() => true) }));

import { POST as postEstimate } from '@/app/api/pricing/estimate/route';
import { GET as getPublicRateCard } from '@/app/api/pricing/rate-card/route';
import { getActivePricingSettings } from '@/lib/business/pricing/store';

const standardStudio: EstimateInput = {
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
};

const activeRateCard = {
  version: 1,
  createdAt: new Date('2026-10-26T00:00:00.000Z'),
  settings: defaultPricingSettings,
};

describe('Mintbloom v3 pricing examples', () => {
  it('prices a 500 sq. ft. studio Standard estimate at $145 before tax', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, standardStudio);

    expect(estimate.status).toBe('priced');
    expect(estimate.subtotalCents).toBe(14_500);
    expect(estimate.taxCents).toBe(1_196);
  });

  it('prices a 1,200 sq. ft., 2-bedroom/2-bath Standard estimate at $268 before tax', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 1_200,
      bedrooms: 2,
      fullBaths: 2,
    });

    expect(estimate.status).toBe('priced');
    expect(estimate.subtotalCents).toBe(26_800);
    expect(estimate.taxCents).toBe(2_211);
  });

  it('adds $0.08 for each square foot above the included 600', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 601,
      fullBaths: 0,
    });

    expect(estimate.coreCents).toBe(14_508);
  });

  it('adds oven and refrigerator charges to the 2-bedroom/2-bath Standard estimate', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 1_200,
      bedrooms: 2,
      fullBaths: 2,
      ovenCavities: 1,
      refrigeratorCount: 1,
    });

    expect(estimate.subtotalCents).toBe(37_300);
  });

  it('applies an eligible weekly discount before calculating tax', () => {
    const estimate = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 1_200,
      bedrooms: 2,
      fullBaths: 2,
      ovenCavities: 1,
      refrigeratorCount: 1,
      cadence: 'weekly',
      returningRecurring: true,
    });

    expect(estimate.discountCents).toBe(2_680);
    expect(estimate.netCents).toBe(24_120);
    expect(estimate.subtotalCents).toBe(34_620);
    expect(estimate.taxCents).toBe(2_856);
  });

  it('includes one oven and refrigerator for Move and labels billed extras', () => {
    const included = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      service: 'move',
      ovenCavities: 1,
      refrigeratorCount: 1,
    });
    const extraOven = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      service: 'move',
      ovenCavities: 2,
      refrigeratorCount: 1,
    });
    const extraFridge = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      service: 'move',
      ovenCavities: 1,
      refrigeratorCount: 2,
    });

    expect(included.addOnsCents).toBe(0);
    expect(extraOven.lines.find((line) => line.id === 'oven-extra')).toMatchObject({
      label: 'Oven interior (extra)',
      amountCents: 6_000,
    });
    expect(extraFridge.lines.find((line) => line.id === 'refrigerator-extra')).toMatchObject({
      label: 'Refrigerator interior (extra)',
      amountCents: 4_500,
    });
  });

  it('charges baseboards by each started 1,000 square feet', () => {
    const at1000 = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 1_000,
      fullBaths: 0,
      baseboards: true,
    });
    const at1001 = calculateEstimate(1, defaultPricingSettings, {
      ...standardStudio,
      squareFeet: 1_001,
      fullBaths: 0,
      baseboards: true,
    });

    expect(at1000.lines.find((line) => line.id === 'baseboards')?.amountCents).toBe(4_000);
    expect(at1001.lines.find((line) => line.id === 'baseboards')?.amountCents).toBe(8_000);
  });

  it('rejects zero and negative square-foot inputs', () => {
    expect(estimateInputSchema.safeParse({ ...standardStudio, squareFeet: 0 }).success).toBe(false);
    expect(estimateInputSchema.safeParse({ ...standardStudio, squareFeet: -1 }).success).toBe(false);
  });

  it('routes inactive or disabled markets to a quote', () => {
    const disabled = {
      ...defaultPricingSettings,
      markets: defaultPricingSettings.markets.map((market) =>
        market.city === 'Lubbock' ? { ...market, pricingEnabled: false } : market,
      ),
    };
    const estimate = calculateEstimate(1, disabled, standardStudio);

    expect(estimate.status).toBe('quote_required');
    expect(estimate.totalCents).toBeNull();
  });

  it('keeps commercial and post-construction requests quote-only without public internal rates', () => {
    for (const service of ['commercial', 'postConstruction'] as const) {
      const estimate = calculateEstimate(1, defaultPricingSettings, {
        ...standardStudio,
        service,
      });

      expect(estimate.status).toBe('quote_required');
      expect(estimate.totalCents).toBeNull();
      expect(JSON.stringify(estimate)).not.toContain('commercialReferenceCentsPerSqFt');
      expect(JSON.stringify(estimate)).not.toContain('/sq ft');
    }
  });
});

describe('public pricing response caching', () => {
  beforeEach(() => {
    vi.mocked(getActivePricingSettings).mockReset();
    vi.mocked(getActivePricingSettings).mockResolvedValue(activeRateCard);
  });

  it('returns no-store on successful and failed active rate-card reads', async () => {
    const success = await getPublicRateCard();
    expect(success.status).toBe(200);
    expect(success.headers.get('Cache-Control')).toBe('no-store');
    expect(JSON.stringify(await success.json())).not.toContain(
      'commercialReferenceCentsPerSqFt',
    );

    vi.mocked(getActivePricingSettings).mockRejectedValueOnce(new Error('database unavailable'));
    const failure = await getPublicRateCard();
    expect(failure.status).toBe(503);
    expect(failure.headers.get('Cache-Control')).toBe('no-store');
  });

  it('returns no-store on successful and failed estimates', async () => {
    const request = () =>
      new Request('http://localhost:3000/api/pricing/estimate', {
        method: 'POST',
        headers: { 'content-type': 'application/json', origin: 'http://localhost:3000' },
        body: JSON.stringify(standardStudio),
      });

    const success = await postEstimate(request());
    expect(success.status).toBe(200);
    expect(success.headers.get('Cache-Control')).toBe('no-store');

    vi.mocked(getActivePricingSettings).mockRejectedValueOnce(new Error('database unavailable'));
    const failure = await postEstimate(request());
    expect(failure.status).toBe(503);
    expect(failure.headers.get('Cache-Control')).toBe('no-store');
  });
});
