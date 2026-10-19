import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  visitFindUnique: vi.fn(),
  visitFindMany: vi.fn(),
  bookingFindUnique: vi.fn(),
  bookingFindMany: vi.fn(),
  recleanFindFirst: vi.fn(),
  recleanCreate: vi.fn(),
}));

vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    visit: { findUnique: mocks.visitFindUnique, findMany: mocks.visitFindMany },
    booking: { findUnique: mocks.bookingFindUnique, findMany: mocks.bookingFindMany },
    recleanRequest: { findFirst: mocks.recleanFindFirst, create: mocks.recleanCreate },
  },
}));

import { POST as postReclean } from '@/app/api/visits/[id]/re-clean/route';
import { GET as getVisit } from '@/app/api/visits/[id]/route';
import { GET as getVisits } from '@/app/api/visits/route';

const user = { id: 'user_a', email: 'Customer.A@Example.com', emailVerified: true };

function visit(overrides: Record<string, unknown> = {}) {
  return {
    id: 'visit_a',
    bookingId: 'booking_a',
    customerUserId: null,
    customerEmail: 'other@example.com',
    serviceDate: new Date('2026-09-08T00:00:00.000Z'),
    serviceType: 'Recurring residential clean',
    serviceDetails: 'Kitchen and bathrooms',
    addressLine1: '100 Main Street',
    addressLine2: null,
    city: 'Lubbock',
    state: 'TX',
    zip: '79401',
    completionStatus: 'completed' as const,
    completionSummary: 'Completed successfully.',
    completedAt: new Date('2026-09-08T16:00:00.000Z'),
    photos: [],
    ...overrides,
  };
}

describe('visit routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue(user);
    mocks.bookingFindMany.mockResolvedValue([{ id: 'booking_a' }]);
    mocks.bookingFindUnique.mockResolvedValue({ email: 'Customer.A@Example.com' });
    mocks.recleanFindFirst.mockResolvedValue(null);
  });

  it('lists only authorized report summaries using the verified user and booking email', async () => {
    mocks.visitFindMany.mockResolvedValue([
      {
        id: 'visit_a',
        serviceDate: new Date('2026-09-08T00:00:00.000Z'),
        serviceType: 'Deep clean',
        completionStatus: 'completed',
      },
    ]);

    const response = await getVisits(new Request('http://localhost/api/visits'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      visits: [
        {
          id: 'visit_a',
          serviceDate: '2026-09-08',
          serviceType: 'Deep clean',
          completionStatus: 'completed',
        },
      ],
    });
    expect(mocks.visitFindMany.mock.calls[0]?.[0].where.OR).toEqual([
      { customerUserId: 'user_a' },
      { customerEmail: { equals: 'customer.a@example.com', mode: 'insensitive' } },
      { bookingId: { in: ['booking_a'] } },
    ]);
  });

  it('rejects anonymous callers before reading reports', async () => {
    mocks.requireAuth.mockRejectedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const response = await getVisits(new Request('http://localhost/api/visits'));
    expect(response.status).toBe(401);
    expect(mocks.visitFindMany).not.toHaveBeenCalled();
  });

  it('returns a non-disclosing 404 for another customer', async () => {
    mocks.visitFindUnique.mockResolvedValue(visit());
    mocks.bookingFindUnique.mockResolvedValue({ email: 'someone-else@example.com' });

    const response = await getVisit(new Request('http://localhost/api/visits/visit_a'), {
      params: Promise.resolve({ id: 'visit_a' }),
    });
    expect(response.status).toBe(404);
    expect(await response.json()).toEqual({ error: 'Visit not found' });
    expect(mocks.recleanFindFirst).not.toHaveBeenCalled();
  });

  it('authorizes a report through the linked booking email and returns the safe projection', async () => {
    mocks.visitFindUnique.mockResolvedValue(
      visit({
        photos: [
          {
            id: 'photo_a',
            url: 'https://media.example.test/photo.jpg',
            altText: 'Clean kitchen',
            caption: 'Kitchen',
            capturedAt: new Date('2026-09-08T15:30:00.000Z'),
          },
        ],
      }),
    );
    mocks.bookingFindUnique.mockResolvedValue({ email: 'CUSTOMER.A@example.com' });

    const response = await getVisit(new Request('http://localhost/api/visits/visit_a'), {
      params: Promise.resolve({ id: 'visit_a' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body.visit).toMatchObject({
      id: 'visit_a',
      serviceDate: '2026-09-08',
      completionStatus: 'completed',
      activeRecleanRequest: null,
    });
    expect(body.visit.photos[0]).toMatchObject({ id: 'photo_a', alt: 'Clean kitchen' });
  });

  it('creates the first active re-clean request without accepting ownership fields', async () => {
    mocks.visitFindUnique.mockResolvedValue(visit({ customerUserId: 'user_a' }));
    mocks.recleanCreate.mockResolvedValue({
      id: 'request_a',
      status: 'active',
      reason: null,
      createdAt: new Date('2026-09-08T16:10:00.000Z'),
    });

    const response = await postReclean(
      new Request('http://localhost/api/visits/visit_a/re-clean', {
        method: 'POST',
        body: JSON.stringify({ reason: '', userId: 'attacker' }),
      }),
      { params: Promise.resolve({ id: 'visit_a' }) },
    );
    expect(response.status).toBe(400);
    expect(mocks.recleanCreate).not.toHaveBeenCalled();

    const validResponse = await postReclean(
      new Request('http://localhost/api/visits/visit_a/re-clean', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'visit_a' }) },
    );
    expect(validResponse.status).toBe(201);
    expect(await validResponse.json()).toEqual({
      recleanRequest: {
        id: 'request_a',
        status: 'active',
        reason: null,
        createdAt: '2026-09-08T16:10:00.000Z',
      },
    });
    expect(mocks.recleanCreate.mock.calls[0]?.[0].data).toEqual({
      visitId: 'visit_a',
      requesterUserId: 'user_a',
      status: 'active',
      reason: null,
      activeKey: 'visit_a',
    });
  });

  it('maps the database active-key conflict to 409', async () => {
    mocks.visitFindUnique.mockResolvedValue(visit({ customerUserId: 'user_a' }));
    mocks.recleanCreate.mockRejectedValue({ code: 'P2002' });

    const response = await postReclean(
      new Request('http://localhost/api/visits/visit_a/re-clean', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
      { params: Promise.resolve({ id: 'visit_a' }) },
    );
    expect(response.status).toBe(409);
  });
});
