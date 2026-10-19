import { describe, expect, it } from 'vitest';
import {
  RecleanRequest,
  RecleanRequestCreate,
  VisitReportResponse,
  VisitSummaryList,
} from '@/lib/contracts/visits';

const photo = {
  id: 'photo_1',
  url: 'https://media.example.test/spot-check.jpg',
  alt: 'Freshly cleaned kitchen counters',
  caption: 'Kitchen counters and sink',
  capturedAt: '2026-09-08T15:30:00.000Z',
};

const report = {
  id: 'visit_1',
  serviceDate: '2026-09-08',
  serviceType: 'Recurring residential clean',
  serviceDetails: 'Kitchen, bathrooms, and common areas',
  address: {
    addressLine1: '100 Main Street',
    addressLine2: null,
    city: 'Lubbock',
    state: 'TX',
    zip: '79401',
  },
  completionStatus: 'completed' as const,
  completionSummary: 'The visit was completed successfully.',
  completedAt: '2026-09-08T16:00:00.000Z',
  photos: [photo],
  activeRecleanRequest: null,
};

describe('visit contracts', () => {
  it('accepts calendar dates, completion timestamps, and photo records', () => {
    expect(VisitReportResponse.parse({ visit: report }).visit.photos).toEqual([photo]);
    expect(
      VisitSummaryList.parse({
        visits: [
          {
            id: 'visit_1',
            serviceDate: '2026-09-08',
            serviceType: 'Deep clean',
            completionStatus: 'needs_attention',
          },
        ],
      }).visits[0]?.completionStatus,
    ).toBe('needs_attention');
  });

  it('rejects malformed dates, statuses, and inaccessible photo metadata', () => {
    expect(
      VisitReportResponse.safeParse({ visit: { ...report, serviceDate: '09/08/2026' } }).success,
    ).toBe(false);
    expect(
      VisitReportResponse.safeParse({ visit: { ...report, completionStatus: 'done' } }).success,
    ).toBe(false);
    expect(
      VisitReportResponse.safeParse({ visit: { ...report, photos: [{ ...photo, alt: '' }] } })
        .success,
    ).toBe(false);
  });

  it('validates an active request and keeps the request body bounded', () => {
    const active = RecleanRequest.parse({
      id: 'request_1',
      status: 'active',
      reason: null,
      createdAt: '2026-09-08T16:10:00.000Z',
    });
    expect(active.status).toBe('active');
    expect(RecleanRequestCreate.parse({})).toEqual({});
    expect(RecleanRequestCreate.safeParse({ reason: 'x'.repeat(501) }).success).toBe(false);
    expect(RecleanRequestCreate.safeParse({ requesterUserId: 'never-accepted' }).success).toBe(
      false,
    );
  });
});
