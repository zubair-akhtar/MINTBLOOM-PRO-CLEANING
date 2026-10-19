import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  getOwnerBookings: vi.fn(),
}));

vi.mock('server-only', () => ({}));
vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('@/lib/business/owner-bookings', () => ({ getOwnerBookings: mocks.getOwnerBookings }));

import { GET } from '@/app/api/admin/bookings/route';

const response = {
  items: [],
  meta: { total: 0, upcomingCount: 0, pastCount: 0 },
};

describe('admin bookings route', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.requireAuth.mockResolvedValue({ id: 'owner_1', role: 'admin', emailVerified: true });
    mocks.getOwnerBookings.mockResolvedValue(response);
  });

  it('rejects unauthenticated callers before reading bookings', async () => {
    mocks.requireAuth.mockRejectedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const result = await GET(new Request('http://localhost/api/admin/bookings'));
    expect(result.status).toBe(401);
    expect(mocks.getOwnerBookings).not.toHaveBeenCalled();
  });

  it('rejects non-admin callers before reading bookings', async () => {
    mocks.requireAuth.mockResolvedValue({ id: 'customer_1', role: 'user' });
    const result = await GET(new Request('http://localhost/api/admin/bookings'));
    expect(result.status).toBe(403);
    expect(await result.json()).toEqual({ error: 'Forbidden' });
    expect(mocks.getOwnerBookings).not.toHaveBeenCalled();
  });

  it('rejects invalid filters and returns the typed admin projection for an admin', async () => {
    const invalid = await GET(new Request('http://localhost/api/admin/bookings?range=tomorrow'));
    expect(invalid.status).toBe(400);
    expect(mocks.getOwnerBookings).not.toHaveBeenCalled();

    const result = await GET(
      new Request(
        'http://localhost/api/admin/bookings?range=all&service=builder_inquiry&status=builder_new',
      ),
    );
    expect(result.status).toBe(200);
    expect(await result.json()).toEqual(response);
    expect(mocks.getOwnerBookings).toHaveBeenCalledWith({
      range: 'all',
      service: 'builder_inquiry',
      status: 'builder_new',
    });
  });

  it('returns a structured server error without exposing source data', async () => {
    mocks.getOwnerBookings.mockRejectedValue(new Error('database unavailable'));
    const result = await GET(new Request('http://localhost/api/admin/bookings'));
    expect(result.status).toBe(500);
    expect(await result.json()).toEqual({ error: 'Could not load owner bookings' });
  });
});
