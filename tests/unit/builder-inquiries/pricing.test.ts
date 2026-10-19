// @polsia:user-owned — pure builder budgetary pricing coverage.
// @vitest-environment node
import { describe, expect, it, vi } from 'vitest';
import { calculateBuilderEstimate } from '@/lib/business/builder-inquiries';

vi.mock('server-only', () => ({}));

const base = {
  projectAddressLine1: '100 Handover Avenue',
  projectAddressLine2: '',
  projectCity: 'Lubbock',
  projectState: 'TX',
  projectZip: '79401',
  startingUnitCount: 1,
  totalPlannedUnitCount: 1,
  approximateSquareFootage: 800,
  furnishingStatus: 'empty' as const,
  constructionStage: 'ready_for_handover' as const,
  siteAccess: 'open_access' as const,
  utilityReadiness: 'utilities_on' as const,
  targetHandoverDate: '2026-11-15',
  preferredFinalCleanDate: '2026-11-13',
  isPhased: false,
  isRecurring: false,
  unitMix: [{ unitType: 'oneBedroom' as const, count: 1 }],
  cleaningScopes: ['final'] as Array<'rough' | 'final' | 'punchList'>,
  remainingDebris: 'None expected.',
  appliancesWindowsOther: 'Interior windows.',
  notes: '',
};

describe('builder budgetary pricing', () => {
  it('covers every volume band with integer ranges and a disclaimer', () => {
    const cases = [
      [1, '1-4'],
      [5, '5-19'],
      [20, '20-49'],
      [50, '50+'],
    ] as const;
    for (const [units, volumeBand] of cases) {
      const estimate = calculateBuilderEstimate({
        ...base,
        startingUnitCount: units,
        totalPlannedUnitCount: units,
        approximateSquareFootage: units * 800,
        unitMix: [{ unitType: 'oneBedroom', count: units }],
      });
      expect(estimate.volumeBand).toBe(volumeBand);
      expect(Number.isInteger(estimate.perUnitLowCents)).toBe(true);
      expect(Number.isInteger(estimate.projectHighCents)).toBe(true);
      expect(estimate.disclaimer).toContain('non-binding');
    }
  });

  it('changes the range for unit type and selected cleaning scopes', () => {
    const final = calculateBuilderEstimate(base);
    const largerAndPhased = calculateBuilderEstimate({
      ...base,
      approximateSquareFootage: 1800,
      unitMix: [{ unitType: 'threeBedroom', count: 1 }],
      cleaningScopes: ['rough', 'final', 'punchList'],
    });
    expect(largerAndPhased.perUnitHighCents).toBeGreaterThan(final.perUnitHighCents);
    expect(largerAndPhased.assumptions.join(' ')).toContain('rough, final, punchList');
  });

  it('applies service-area travel and volume factors', () => {
    const core = calculateBuilderEstimate(base);
    const extended = calculateBuilderEstimate({
      ...base,
      projectState: 'NM',
      projectZip: '87101',
      totalPlannedUnitCount: 20,
      startingUnitCount: 20,
      approximateSquareFootage: 16000,
      unitMix: [{ unitType: 'oneBedroom', count: 20 }],
    });
    expect(extended.areaClassification).toBe('extended');
    expect(extended.projectUnitCount).toBe(20);
    expect(extended.assumptions.join(' ')).toContain('Extended-area travel');
    expect(core.perUnitLowCents).toBeGreaterThan(0);
  });

  it('weights mixed unit types instead of pricing every unit as one type', () => {
    const mixed = calculateBuilderEstimate({
      ...base,
      totalPlannedUnitCount: 4,
      startingUnitCount: 4,
      approximateSquareFootage: 4000,
      unitMix: [
        { unitType: 'studio', count: 2 },
        { unitType: 'threeBedroom', count: 2 },
      ],
    });
    const studios = calculateBuilderEstimate({
      ...base,
      totalPlannedUnitCount: 4,
      startingUnitCount: 4,
      approximateSquareFootage: 4000,
      unitMix: [{ unitType: 'studio', count: 4 }],
    });
    expect(mixed.perUnitLowCents).toBeGreaterThan(studios.perUnitLowCents);
    expect(mixed.perUnitHighCents).toBeLessThan(
      calculateBuilderEstimate({
        ...base,
        totalPlannedUnitCount: 4,
        startingUnitCount: 4,
        approximateSquareFootage: 4000,
        unitMix: [{ unitType: 'threeBedroom', count: 4 }],
      }).perUnitHighCents,
    );
  });
});
