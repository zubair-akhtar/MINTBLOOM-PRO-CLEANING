// @polsia:user-owned — builder inquiry contract coverage.
import { describe, expect, it } from 'vitest';
import {
  BuilderBudgetaryEstimate,
  BuilderEstimateRequest,
  BuilderInquirySubmission,
} from '@/lib/contracts/builder-inquiries';

const project = {
  projectAddressLine1: '100 Handover Avenue',
  projectAddressLine2: 'Building A',
  projectCity: 'Lubbock',
  projectState: 'TX',
  projectZip: '79401',
  startingUnitCount: 4,
  totalPlannedUnitCount: 8,
  approximateSquareFootage: 7200,
  furnishingStatus: 'empty' as const,
  constructionStage: 'substantially_complete' as const,
  siteAccess: 'coordinated_access' as const,
  utilityReadiness: 'utilities_on' as const,
  targetHandoverDate: '2026-11-15',
  preferredFinalCleanDate: '2026-11-13',
  isPhased: true,
  isRecurring: false,
  unitMix: [
    { unitType: 'oneBedroom' as const, count: 4 },
    { unitType: 'twoBedroom' as const, count: 4 },
  ],
  cleaningScopes: ['rough', 'final', 'punchList'] as const,
  remainingDebris: 'Light drywall dust and packaging remain.',
  appliancesWindowsOther: 'Interior windows and appliance interiors.',
  notes: 'Coordinate with the superintendent.',
};

describe('builder inquiry contracts', () => {
  it('accepts the complete project brief and estimate request', () => {
    expect(
      BuilderInquirySubmission.safeParse({
        companyName: 'Northline Development',
        projectContactName: 'Jordan Lee',
        projectContactEmail: 'jordan@example.com',
        projectContactPhone: '806-555-0188',
        ...project,
      }).success,
    ).toBe(true);
    expect(BuilderEstimateRequest.safeParse(project).success).toBe(true);
  });

  it('requires dates, positive counts, and a unit mix that matches total units', () => {
    const result = BuilderEstimateRequest.safeParse({
      ...project,
      targetHandoverDate: '2026-02-30',
      startingUnitCount: 9,
      unitMix: [{ unitType: 'oneBedroom', count: 3 }],
    });
    expect(result.success).toBe(false);
    if (result.success) return;
    const messages = result.error.issues.map((issue) => issue.message).join(' ');
    expect(messages).toContain('valid calendar date');
    expect(messages).toContain('at least the starting unit count');
    expect(messages).toContain('add up to total planned units');
  });

  it('rejects an empty scope selection and invalid volume shape', () => {
    const result = BuilderEstimateRequest.safeParse({
      ...project,
      cleaningScopes: [],
      totalPlannedUnitCount: 0,
    });
    expect(result.success).toBe(false);
  });

  it('accepts and types a budgetary non-binding result', () => {
    const result = BuilderBudgetaryEstimate.parse({
      status: 'budgetary',
      areaClassification: 'nearby',
      volumeBand: '20-49',
      projectUnitCount: 24,
      perUnitLowCents: 18000,
      perUnitHighCents: 26000,
      projectLowCents: 432000,
      projectHighCents: 624000,
      perUnitRange: '$180.00–$260.00 / unit',
      projectRange: '$4,320.00–$6,240.00 total',
      assumptions: ['Weighted mix'],
      disclaimer: 'Budgetary and non-binding.',
    });
    expect(result.status).toBe('budgetary');
    expect(result.disclaimer).toContain('non-binding');
  });
});
