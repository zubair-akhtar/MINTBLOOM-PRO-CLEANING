import { describe, expect, it } from 'vitest';
import {
  BillingPortalResponse,
  ManageSubscription,
  ManageSubscriptionAction,
  ManageSubscriptionPause,
  ManageSubscriptionRequest,
  ManageSubscriptionReschedule,
  ManageSubscriptionResponse,
  manageSubscriptionTier,
} from '@/lib/contracts/manage-subscription';

const active = {
  id: 'booking_123',
  tier: 'weekly' as const,
  cadence: 'weekly' as const,
  nextScheduledVisit: '2026-09-14',
  cancellationCutoffAt: '2026-09-13T00:00:00.000Z',
  paidAmountCents: 12500,
  refundEligibility: 'eligible' as const,
  status: 'active' as const,
};

describe('manage subscription contract', () => {
  it('limits service cadence choices to the supported tiers', () => {
    expect(manageSubscriptionTier.options).toEqual(['weekly', 'biweekly', 'monthly']);
    expect(manageSubscriptionTier.safeParse('monthly').success).toBe(true);
    expect(manageSubscriptionTier.safeParse('annual').success).toBe(false);
  });

  it('accepts active and paused projections with date-shaped visits', () => {
    expect(ManageSubscription.safeParse(active).success).toBe(true);
    expect(
      ManageSubscription.safeParse({ ...active, status: 'paused', cadence: 'monthly' }).success,
    ).toBe(true);
    expect(
      ManageSubscription.safeParse({ ...active, nextScheduledVisit: 'tomorrow' }).success,
    ).toBe(false);
  });

  it('accepts a nullable response for the safe empty state', () => {
    expect(
      ManageSubscriptionResponse.safeParse({ subscription: active, cancellation: null }).success,
    ).toBe(true);
    expect(
      ManageSubscriptionResponse.safeParse({ subscription: null, cancellation: null }).success,
    ).toBe(true);
  });

  it('accepts pause and cancel actions and validates the billing portal response', () => {
    expect(
      ManageSubscriptionPause.safeParse({ action: 'pause', bookingId: 'booking_123' }).success,
    ).toBe(true);
    expect(
      ManageSubscriptionPause.safeParse({ action: 'resume', bookingId: 'booking_123' }).success,
    ).toBe(false);
    expect(
      ManageSubscriptionAction.safeParse({ action: 'cancel', bookingId: 'booking_123' }).success,
    ).toBe(true);
    expect(
      BillingPortalResponse.safeParse({ url: 'https://billing.example.test/session' }).success,
    ).toBe(true);
  });

  it('accepts a strict reschedule request and rejects invalid dates or ownership fields', () => {
    const request = {
      action: 'reschedule' as const,
      bookingId: 'booking_123',
      targetDate: '2026-09-27',
    };
    expect(ManageSubscriptionReschedule.safeParse(request).success).toBe(true);
    expect(ManageSubscriptionRequest.safeParse(request).success).toBe(true);
    expect(
      ManageSubscriptionReschedule.safeParse({ ...request, targetDate: '2026-02-30' }).success,
    ).toBe(false);
    expect(
      ManageSubscriptionReschedule.safeParse({ ...request, email: 'other@example.com' }).success,
    ).toBe(false);
  });

  it('accepts a typed reschedule success outcome', () => {
    expect(
      ManageSubscriptionResponse.safeParse({
        subscription: active,
        cancellation: null,
        reschedule: {
          action: 'reschedule',
          bookingId: 'booking_123',
          previousServiceDate: '2026-09-20',
          nextScheduledVisit: '2026-09-27',
        },
      }).success,
    ).toBe(true);
  });
});
