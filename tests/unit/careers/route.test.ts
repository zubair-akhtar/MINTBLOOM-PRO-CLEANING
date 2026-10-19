import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  openingFindMany: vi.fn(),
  openingFindUnique: vi.fn(),
  marketFindMany: vi.fn(),
  marketFindFirst: vi.fn(),
  applicationCreate: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: {
    jobOpening: { findMany: mocks.openingFindMany, findUnique: mocks.openingFindUnique },
    serviceMarket: { findMany: mocks.marketFindMany, findFirst: mocks.marketFindFirst },
    jobApplication: { create: mocks.applicationCreate },
  },
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }));

import { POST as POST_APPLICATION } from '@/app/api/careers/applications/route';
import { GET } from '@/app/api/careers/route';

const market = { id: 'market_lubbock', name: 'Lubbock', city: 'Lubbock', state: 'TX' };
const opening = {
  id: 'opening_cleaner',
  title: 'Residential Cleaner',
  role: 'Cleaner',
  employmentArea: 'Local residential cleaning',
  state: 'TX',
  city: 'Lubbock',
  marketId: market.id,
  schedule: 'Details shared in the posted role',
  requirements: 'Reliable and thoughtful service.',
  compensation: null,
  publishedAt: new Date('2026-09-01T12:00:00.000Z'),
};

describe('careers routes', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.marketFindMany.mockResolvedValue([market]);
    mocks.marketFindFirst.mockResolvedValue(market);
    mocks.sendEmail.mockResolvedValue({ id: 'email_1' });
  });

  it('returns only the active-opening query projection and market options', async () => {
    mocks.openingFindMany.mockResolvedValue([]);
    const response = await GET();

    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({ openings: [], markets: [market] });
    expect(mocks.openingFindMany.mock.calls[0]?.[0].where).toEqual({
      status: 'published',
      closedAt: null,
      market: { isActive: true },
    });
  });

  it('rejects a stale or unpublished opening before creating an application', async () => {
    mocks.openingFindUnique.mockResolvedValue(null);
    const response = await POST_APPLICATION(
      new Request('http://localhost/api/careers/applications', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Taylor Cleaner',
          email: 'taylor@example.com',
          roleInterest: 'Cleaner',
          openingId: 'opening_stale',
          availability: 'Weekday mornings',
          consent: true,
        }),
      }),
    );

    expect(response.status).toBe(409);
    expect(mocks.applicationCreate).not.toHaveBeenCalled();
  });

  it('creates an application and attempts the internal notification after persistence', async () => {
    mocks.openingFindUnique.mockResolvedValue({
      ...opening,
      status: 'published',
      closedAt: null,
      market: { isActive: true },
    });
    mocks.applicationCreate.mockResolvedValue({ id: 'application_1' });

    const response = await POST_APPLICATION(
      new Request('http://localhost/api/careers/applications', {
        method: 'POST',
        body: JSON.stringify({
          fullName: 'Taylor Cleaner',
          email: 'Taylor@Example.com',
          roleInterest: 'Cleaner',
          openingId: opening.id,
          marketId: market.id,
          availability: 'Weekday mornings',
          consent: true,
        }),
      }),
    );

    expect(response.status).toBe(201);
    expect(await response.json()).toMatchObject({ applicationId: 'application_1' });
    expect(mocks.applicationCreate.mock.calls[0]?.[0].data).toMatchObject({
      email: 'taylor@example.com',
      openingId: opening.id,
      marketId: market.id,
      consent: true,
    });
    expect(mocks.sendEmail).toHaveBeenCalledOnce();
  });

  it('maps malformed application input to field errors', async () => {
    const response = await POST_APPLICATION(
      new Request('http://localhost/api/careers/applications', {
        method: 'POST',
        body: JSON.stringify({}),
      }),
    );

    expect(response.status).toBe(400);
    expect(await response.json()).toEqual(expect.objectContaining({ errors: expect.any(Object) }));
    expect(mocks.openingFindUnique).not.toHaveBeenCalled();
  });

  it('keeps the public route valid when there are no live openings', async () => {
    mocks.openingFindMany.mockResolvedValue([]);
    const response = await GET();
    const body = await response.json();

    expect(response.status).toBe(200);
    expect(body.openings).toEqual([]);
    expect(body.markets).toEqual([market]);
  });
});
