import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  requireAuth: vi.fn(),
  findFirst: vi.fn(),
  updateMany: vi.fn(),
  sendEmail: vi.fn(),
}));

vi.mock('@/lib/require-auth', () => ({ requireAuth: mocks.requireAuth }));
vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({
  prisma: { booking: { findFirst: mocks.findFirst, updateMany: mocks.updateMany } },
}));
vi.mock('@/lib/email/send', () => ({ sendEmail: mocks.sendEmail }));

import { GET, PATCH } from '@/app/api/manage/subscription/route';

const user = { id: 'user_a', email: 'Subscriber.A@Example.com', emailVerified: true };
const booking = {
  id: 'booking_a',
  tier: 'biweekly' as const,
  cadence: 'biweekly' as const,
  serviceDate: new Date('2026-09-20T00:00:00.000Z'),
  paymentAmountCents: 12500,
  status: 'active' as const,
};
const futureBooking = {
  ...booking,
  serviceDate: new Date('2036-09-20T00:00:00.000Z'),
};

describe('manage subscription route', () => {
  beforeEach(() => {
    vi.resetAllMocks();
  });

  it('scopes reads to the verified session email and returns the projection', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(futureBooking);

    const response = await GET(new Request('http://localhost/api/manage/subscription'));
    expect(response.status).toBe(200);
    expect(await response.json()).toEqual({
      subscription: {
        id: 'booking_a',
        tier: 'biweekly',
        cadence: 'biweekly',
        nextScheduledVisit: '2036-09-20',
        cancellationCutoffAt: '2036-09-19T00:00:00.000Z',
        paidAmountCents: 12500,
        refundEligibility: 'eligible',
        status: 'active',
      },
      cancellation: null,
    });
    expect(mocks.findFirst.mock.calls[0]?.[0].where.email).toMatchObject({
      equals: 'subscriber.a@example.com',
      mode: 'insensitive',
    });
    expect(mocks.findFirst.mock.calls[0]?.[0].where.serviceType).toBe('recurringResidential');
  });

  it('rejects unauthenticated and unverified callers before querying', async () => {
    mocks.requireAuth.mockRejectedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const unauthenticated = await GET(new Request('http://localhost/api/manage/subscription'));
    expect(unauthenticated.status).toBe(401);
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    expect(mocks.findFirst).not.toHaveBeenCalled();

    mocks.requireAuth.mockResolvedValue({ ...user, emailVerified: false });
    const unverified = await GET(new Request('http://localhost/api/manage/subscription'));
    expect(unverified.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('updates only the owner row and records an idempotent pause outcome', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst
      .mockResolvedValueOnce(futureBooking)
      .mockResolvedValueOnce({ ...futureBooking, status: 'paused' });
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const first = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pause', bookingId: 'booking_a' }),
      }),
    );
    expect(first.status).toBe(200);
    expect(await first.json()).toMatchObject({
      subscription: null,
      cancellation: {
        action: 'pause',
        scheduledServiceDate: '2036-09-20',
        refundEligibility: 'eligible',
        refundStatus: 'unavailable',
        outcome: 'refund_unavailable',
      },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({ id: 'booking_a', status: 'active' }),
        data: expect.objectContaining({ status: 'paused' }),
      }),
    );

    mocks.findFirst
      .mockResolvedValueOnce({ ...booking, status: 'paused' })
      .mockResolvedValueOnce({ ...booking, status: 'paused' });
    const second = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pause', bookingId: 'booking_a' }),
      }),
    );
    expect(second.status).toBe(200);
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
  });

  it('does not update another customer or fabricate a subscription', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(null);

    const crossCustomer = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'pause', bookingId: 'booking_b' }),
      }),
    );
    expect(crossCustomer.status).toBe(404);
    expect(mocks.updateMany).not.toHaveBeenCalled();

    const empty = await GET(new Request('http://localhost/api/manage/subscription'));
    expect(empty.status).toBe(200);
    expect(await empty.json()).toEqual({ subscription: null, cancellation: null });
  });

  it('requires verified auth for rescheduling and rejects invalid dates', async () => {
    mocks.requireAuth.mockRejectedValue(Response.json({ error: 'Unauthorized' }, { status: 401 }));
    const unauthenticated = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );
    expect(unauthenticated.status).toBe(401);

    mocks.requireAuth.mockResolvedValue({ ...user, emailVerified: false });
    const unverified = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-02-30',
        }),
      }),
    );
    expect(unverified.status).toBe(403);
    expect(mocks.findFirst).not.toHaveBeenCalled();
  });

  it('rejects a foreign or non-next booking without revealing it', async () => {
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(booking);

    const response = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_other',
          targetDate: '2026-09-27',
        }),
      }),
    );
    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({ code: 'subscription_not_found' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
  });

  it('does not email for an invalid request or a rejected reschedule date', async () => {
    mocks.requireAuth.mockResolvedValue(user);

    const invalid = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ action: 'reschedule', bookingId: 'booking_a' }),
      }),
    );
    expect(invalid.status).toBe(400);
    expect(mocks.sendEmail).not.toHaveBeenCalled();

    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    mocks.findFirst.mockResolvedValue(booking);
    const rejectedDate = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-09-27',
        }),
      }),
    );
    expect(rejectedDate.status).toBe(400);
    expect(await rejectedDate.json()).toMatchObject({ code: 'cadence_mismatch' });
    expect(mocks.updateMany).not.toHaveBeenCalled();
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('conditionally persists a valid reschedule and returns the updated projection', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(booking);
    mocks.updateMany.mockResolvedValue({ count: 1 });

    const response = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      subscription: {
        id: 'booking_a',
        nextScheduledVisit: '2026-10-04',
      },
      reschedule: {
        action: 'reschedule',
        bookingId: 'booking_a',
        previousServiceDate: '2026-09-20',
        nextScheduledVisit: '2026-10-04',
      },
    });
    expect(mocks.updateMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          id: 'booking_a',
          status: 'active',
          serviceDate: booking.serviceDate,
        }),
        data: { serviceDate: new Date('2026-10-04T00:00:00.000Z') },
      }),
    );
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(mocks.updateMany.mock.invocationCallOrder[0]).toBeLessThan(
      mocks.sendEmail.mock.invocationCallOrder[0] ?? Number.MAX_SAFE_INTEGER,
    );
    expect(mocks.sendEmail).toHaveBeenCalledWith(
      expect.objectContaining({
        to: user.email,
        subject: 'Your Mintbloom recurring clean was rescheduled',
        text: expect.stringContaining('Service: Recurring residential clean · Biweekly'),
      }),
    );
    const message = mocks.sendEmail.mock.calls[0]?.[0];
    expect(message?.text).toContain('Original visit date: September 20, 2026');
    expect(message?.text).toContain('New visit date: October 4, 2026');
    expect(message?.text).toContain('Biweekly visits keep their weekday rhythm.');
    expect(message?.text).toContain(
      'Future reschedule requests must be received at least 24 hours before the scheduled visit.',
    );
    vi.useRealTimers();
  });

  it('keeps a committed reschedule successful when email transport fails', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(booking);
    mocks.updateMany.mockResolvedValue({ count: 1 });
    mocks.sendEmail.mockRejectedValue(new Error('email proxy unavailable'));
    const warningLog = vi.spyOn(process, 'emitWarning').mockImplementation(() => {});

    const response = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );

    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      reschedule: { previousServiceDate: '2026-09-20', nextScheduledVisit: '2026-10-04' },
    });
    expect(mocks.updateMany).toHaveBeenCalledTimes(1);
    expect(mocks.sendEmail).toHaveBeenCalledTimes(1);
    expect(warningLog).toHaveBeenCalledWith(
      'Reschedule confirmation email failed after the booking was updated.',
      { code: 'RESCHEDULE_CONFIRMATION_EMAIL_FAILED' },
    );
    warningLog.mockRestore();
    vi.useRealTimers();
  });

  it('does not email when persistence fails or the conditional update loses a race', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(booking);
    mocks.updateMany.mockRejectedValueOnce(new Error('database unavailable'));

    const persistenceFailure = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );
    expect(persistenceFailure.status).toBe(500);
    expect(mocks.sendEmail).not.toHaveBeenCalled();

    mocks.updateMany.mockResolvedValue({ count: 0 });
    const conflict = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );
    expect(conflict.status).toBe(409);
    expect(await conflict.json()).toMatchObject({ code: 'reschedule_conflict' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });

  it('returns a conflict when the conditional update loses a race', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-09-12T12:00:00.000Z'));
    mocks.requireAuth.mockResolvedValue(user);
    mocks.findFirst.mockResolvedValue(booking);
    mocks.updateMany.mockResolvedValue({ count: 0 });

    const response = await PATCH(
      new Request('http://localhost/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({
          action: 'reschedule',
          bookingId: 'booking_a',
          targetDate: '2026-10-04',
        }),
      }),
    );
    expect(response.status).toBe(409);
    expect(await response.json()).toMatchObject({ code: 'reschedule_conflict' });
    expect(mocks.sendEmail).not.toHaveBeenCalled();
    vi.useRealTimers();
  });
});
