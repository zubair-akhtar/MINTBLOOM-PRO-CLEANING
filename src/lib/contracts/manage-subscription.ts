// @polsia:user-owned — client-safe contract for the subscriber portal.
import { z } from 'zod';

export const manageSubscriptionTier = z.enum(['weekly', 'biweekly', 'monthly']);
const cadence = manageSubscriptionTier;
const tier = manageSubscriptionTier;
function isRealCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00.000Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

const calendarDate = z.string().refine(isRealCalendarDate, 'Expected a real YYYY-MM-DD date');
const refundEligibility = z.enum(['eligible', 'not_eligible', 'not_applicable']);
const refundStatus = z.enum(['unavailable', 'pending', 'refunded', 'not_applicable']);
const cancellationAction = z.enum(['pause', 'cancel']);
const cancellationOutcome = z.enum([
  'refund_unavailable',
  'refund_pending',
  'refunded',
  'late_cancellation_no_refund',
  'not_eligible',
]);

export const CancellationOutcome = z.object({
  action: cancellationAction,
  scheduledServiceDate: calendarDate,
  cutoffAt: z.string().datetime(),
  refundEligibility,
  refundStatus,
  outcome: cancellationOutcome,
  message: z.string().min(1),
});

export const ManageSubscription = z.object({
  id: z.string().min(1),
  tier,
  cadence,
  nextScheduledVisit: calendarDate,
  cancellationCutoffAt: z.string().datetime(),
  paidAmountCents: z.number().int().nonnegative(),
  refundEligibility,
  status: z.enum(['active', 'paused']),
});

export const ManageSubscriptionResponse = z.object({
  subscription: ManageSubscription.nullable(),
  cancellation: CancellationOutcome.nullable(),
  reschedule: z
    .object({
      action: z.literal('reschedule'),
      bookingId: z.string().min(1),
      previousServiceDate: calendarDate,
      nextScheduledVisit: calendarDate,
    })
    .nullable()
    .optional(),
});

export const ManageSubscriptionPause = z.object({
  action: z.literal('pause'),
  bookingId: z.string().min(1),
});

export const ManageSubscriptionAction = z.object({
  action: cancellationAction,
  bookingId: z.string().min(1),
});

export const ManageSubscriptionReschedule = z
  .object({
    action: z.literal('reschedule'),
    bookingId: z.string().min(1),
    targetDate: calendarDate,
  })
  .strict();

export const ManageSubscriptionRequest = z.union([
  ManageSubscriptionAction,
  ManageSubscriptionReschedule,
]);

export const BillingPortalResponse = z.object({ url: z.string().url() });

export type ManageSubscription = z.infer<typeof ManageSubscription>;
export type ManageSubscriptionTier = z.infer<typeof manageSubscriptionTier>;
export type CancellationOutcome = z.infer<typeof CancellationOutcome>;
export type ManageSubscriptionResponse = z.infer<typeof ManageSubscriptionResponse>;
export type ManageSubscriptionPause = z.infer<typeof ManageSubscriptionPause>;
export type ManageSubscriptionAction = z.infer<typeof ManageSubscriptionAction>;
export type ManageSubscriptionReschedule = z.infer<typeof ManageSubscriptionReschedule>;
export type ManageSubscriptionRequest = z.infer<typeof ManageSubscriptionRequest>;
