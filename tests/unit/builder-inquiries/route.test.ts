// @polsia:user-owned — builder inquiry route validation and persistence coverage.
import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  builderInquiryCreate: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: { builderInquiry: { create: mocks.builderInquiryCreate } },
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }));

import { POST as postEstimate } from '@/app/api/builder-inquiries/estimate/route';
import { POST as postInquiry } from '@/app/api/builder-inquiries/route';

const valid = {
  companyName: 'Northline Development',
  projectContactName: 'Jordan Lee',
  projectContactEmail: 'jordan@example.com',
  projectContactPhone: '806-555-0188',
  projectAddressLine1: '100 Handover Avenue',
  projectAddressLine2: 'Building A',
  projectCity: 'Lubbock',
  projectState: 'TX',
  projectZip: '79401',
  startingUnitCount: 4,
  totalPlannedUnitCount: 4,
  approximateSquareFootage: 3200,
  furnishingStatus: 'empty',
  constructionStage: 'substantially_complete',
  siteAccess: 'coordinated_access',
  utilityReadiness: 'utilities_on',
  targetHandoverDate: '2026-11-15',
  preferredFinalCleanDate: '2026-11-13',
  isPhased: false,
  isRecurring: false,
  unitMix: [{ unitType: 'oneBedroom', count: 4 }],
  cleaningScopes: ['final'],
  remainingDebris: 'Light drywall dust.',
  appliancesWindowsOther: 'Interior windows.',
  notes: 'Call before arrival.',
};

describe('builder inquiry routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.builderInquiryCreate.mockResolvedValue({ id: 'builder_inquiry_1' });
    mocks.sendEmail.mockResolvedValue({ id: 'email_1' });
  });

  it('returns field errors for malformed estimate input', async () => {
    const response = await postEstimate(
      new Request('http://localhost/api/builder-inquiries/estimate', {
        method: 'POST',
        body: JSON.stringify({ ...valid, totalPlannedUnitCount: 3 }),
      }),
    );
    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ errors: expect.any(Object) }));
  });

  it('returns a typed budgetary estimate without persisting or emailing', async () => {
    const response = await postEstimate(
      new Request('http://localhost/api/builder-inquiries/estimate', {
        method: 'POST',
        body: JSON.stringify(valid),
      }),
    );
    expect(response.status).toBe(200);
    expect((await response.json()).status).toBe('budgetary');
    expect(mocks.builderInquiryCreate).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('persists the complete brief, returns the estimate, and isolates email failure', async () => {
    mocks.sendEmail.mockRejectedValue(new Error('proxy unavailable'));
    const response = await postInquiry(
      new Request('http://localhost/api/builder-inquiries', {
        method: 'POST',
        body: JSON.stringify(valid),
      }),
    );
    expect(response.status).toBe(201);
    expect(await response.json()).toEqual(
      expect.objectContaining({
        inquiryReference: 'builder_inquiry_1',
        estimate: expect.any(Object),
      }),
    );
    expect(mocks.builderInquiryCreate).toHaveBeenCalledOnce();
    expect(mocks.builderInquiryCreate.mock.calls[0]?.[0].data).toMatchObject({
      companyName: valid.companyName,
      totalPlannedUnitCount: valid.totalPlannedUnitCount,
      projectZip: valid.projectZip,
      cleaningScopesSnapshot: valid.cleaningScopes,
      residueSnapshot: valid.remainingDebris,
    });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it('returns 500 when persistence fails', async () => {
    mocks.builderInquiryCreate.mockRejectedValue(new Error('database unavailable'));
    const response = await postInquiry(
      new Request('http://localhost/api/builder-inquiries', {
        method: 'POST',
        body: JSON.stringify(valid),
      }),
    );
    expect(response.status).toBe(500);
    expect(await response.json()).toEqual({ error: 'builder_inquiry_failed' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });
});
