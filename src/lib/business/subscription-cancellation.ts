// @polsia:user-owned — server-only subscriber cancellation policy.
import 'server-only';

import { prisma } from '@/lib/db';

export const CANCELLATION_WINDOW_HOURS = 24;

export type CancellationAction = 'pause' | 'cancel';
export type RefundEligibility = 'eligible' | 'not_eligible' | 'not_applicable';
export type RefundStatus = 'unavailable' | 'pending' | 'refunded' | 'not_applicable';
export type CancellationOutcomeCode =
  | 'refund_unavailable'
  | 'refund_pending'
  | 'refunded'
  | 'late_cancellation_no_refund'
  | 'not_eligible';

export interface CancellationPolicy {
  cutoffAt: Date;
  refundEligibility: RefundEligibility;
  refundStatus: RefundStatus;
  outcome: CancellationOutcomeCode;
}

function scheduledServiceAt(serviceDate: Date): Date {
  return new Date(
    Date.UTC(serviceDate.getUTCFullYear(), serviceDate.getUTCMonth(), serviceDate.getUTCDate()),
  );
}

export function calculateCancellationPolicy(input: {
  serviceDate: Date;
  paymentAmountCents: number;
  cancelledAt: Date;
}): CancellationPolicy {
  const cutoffAt = new Date(
    scheduledServiceAt(input.serviceDate).getTime() - CANCELLATION_WINDOW_HOURS * 60 * 60 * 1000,
  );

  if (input.paymentAmountCents <= 0) {
    return {
      cutoffAt,
      refundEligibility: 'not_applicable',
      refundStatus: 'not_applicable',
      outcome: 'not_eligible',
    };
  }

  const eligible = input.cancelledAt.getTime() <= cutoffAt.getTime();
  return {
    cutoffAt,
    refundEligibility: eligible ? 'eligible' : 'not_eligible',
    // The installed billing helper has no refund operation. Never claim that a refund happened.
    refundStatus: eligible ? 'unavailable' : 'not_applicable',
    outcome: eligible ? 'refund_unavailable' : 'late_cancellation_no_refund',
  };
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export class SubscriptionNotFoundError extends Error {
  constructor() {
    super('Subscription not found');
    this.name = 'SubscriptionNotFoundError';
  }
}

export interface CancellationResult {
  action: CancellationAction;
  scheduledServiceDate: string;
  cutoffAt: string;
  refundEligibility: RefundEligibility;
  refundStatus: RefundStatus;
  outcome: CancellationOutcomeCode;
  message: string;
}

function resultMessage(outcome: CancellationOutcomeCode): string {
  if (outcome === 'refund_unavailable') {
    return 'Your request was recorded before the 24-hour cutoff. Automatic refunds are currently unavailable; please contact Mintbloom support about this paid service.';
  }
  if (outcome === 'late_cancellation_no_refund') {
    return 'Your request was recorded inside the 24-hour cutoff. This paid service is not eligible for an automatic refund under the current policy.';
  }
  return 'Your service request was recorded.';
}

export function cancellationResultFromStored(booking: {
  action: CancellationAction;
  serviceDate: Date;
  cancelledAt: Date;
  paymentAmountCents: number;
  refundEligibility: string | null;
  refundStatus: string | null;
  cancellationOutcome: string | null;
}): CancellationResult {
  const calculated = calculateCancellationPolicy({
    serviceDate: booking.serviceDate,
    paymentAmountCents: booking.paymentAmountCents,
    cancelledAt: booking.cancelledAt,
  });
  const refundEligibility: RefundEligibility =
    booking.refundEligibility === 'eligible' || booking.refundEligibility === 'not_eligible'
      ? booking.refundEligibility
      : calculated.refundEligibility;
  const refundStatus: RefundStatus =
    booking.refundStatus === 'pending' ||
    booking.refundStatus === 'refunded' ||
    booking.refundStatus === 'unavailable' ||
    booking.refundStatus === 'not_applicable'
      ? booking.refundStatus
      : calculated.refundStatus;
  const outcome: CancellationOutcomeCode =
    booking.cancellationOutcome === 'refund_pending' ||
    booking.cancellationOutcome === 'refunded' ||
    booking.cancellationOutcome === 'refund_unavailable' ||
    booking.cancellationOutcome === 'late_cancellation_no_refund' ||
    booking.cancellationOutcome === 'not_eligible'
      ? booking.cancellationOutcome
      : calculated.outcome;

  return {
    action: booking.action,
    scheduledServiceDate: booking.serviceDate.toISOString().slice(0, 10),
    cutoffAt: calculated.cutoffAt.toISOString(),
    refundEligibility,
    refundStatus,
    outcome,
    message: resultMessage(outcome),
  };
}

export async function cancelSubscriptionForOwner(input: {
  email: string;
  bookingId: string;
  action: CancellationAction;
  now?: Date;
}): Promise<CancellationResult> {
  const now = input.now ?? new Date();
  const email = normalizedEmail(input.email);
  const booking = await prisma.booking.findFirst({
    where: {
      id: input.bookingId,
      email: { equals: email, mode: 'insensitive' },
      serviceType: 'recurringResidential',
      paymentAmountCents: { gt: 0 },
    },
    select: {
      id: true,
      serviceDate: true,
      paymentAmountCents: true,
      status: true,
      cancellationAction: true,
      cancelledAt: true,
      refundEligibility: true,
      refundStatus: true,
      cancellationOutcome: true,
    },
  });
  if (!booking) throw new SubscriptionNotFoundError();

  if (booking.cancelledAt && booking.cancellationAction) {
    return cancellationResultFromStored({
      action: booking.cancellationAction === 'cancel' ? 'cancel' : 'pause',
      serviceDate: booking.serviceDate,
      cancelledAt: booking.cancelledAt,
      paymentAmountCents: booking.paymentAmountCents,
      refundEligibility: booking.refundEligibility,
      refundStatus: booking.refundStatus,
      cancellationOutcome: booking.cancellationOutcome,
    });
  }

  if (booking.status === 'paused') {
    return cancellationResultFromStored({
      action: input.action,
      serviceDate: booking.serviceDate,
      cancelledAt: booking.cancelledAt ?? now,
      paymentAmountCents: booking.paymentAmountCents,
      refundEligibility: booking.refundEligibility,
      refundStatus: booking.refundStatus,
      cancellationOutcome: booking.cancellationOutcome,
    });
  }

  const policy = calculateCancellationPolicy({
    serviceDate: booking.serviceDate,
    paymentAmountCents: booking.paymentAmountCents,
    cancelledAt: now,
  });
  const update = await prisma.booking.updateMany({
    where: { id: booking.id, email: { equals: email, mode: 'insensitive' }, status: 'active' },
    data: {
      status: 'paused',
      pausedAt: now,
      cancelledAt: now,
      cancellationAction: input.action,
      refundEligibility: policy.refundEligibility,
      refundStatus: policy.refundStatus,
      cancellationOutcome: policy.outcome,
    },
  });

  if (update.count === 0) {
    const current = await prisma.booking.findFirst({
      where: { id: booking.id, email: { equals: email, mode: 'insensitive' } },
      select: {
        serviceDate: true,
        paymentAmountCents: true,
        cancellationAction: true,
        cancelledAt: true,
        refundEligibility: true,
        refundStatus: true,
        cancellationOutcome: true,
      },
    });
    if (current?.cancelledAt && current.cancellationAction) {
      return cancellationResultFromStored({
        action: current.cancellationAction === 'cancel' ? 'cancel' : 'pause',
        serviceDate: current.serviceDate,
        cancelledAt: current.cancelledAt,
        paymentAmountCents: current.paymentAmountCents,
        refundEligibility: current.refundEligibility,
        refundStatus: current.refundStatus,
        cancellationOutcome: current.cancellationOutcome,
      });
    }
  }

  return cancellationResultFromStored({
    action: input.action,
    serviceDate: booking.serviceDate,
    cancelledAt: now,
    paymentAmountCents: booking.paymentAmountCents,
    refundEligibility: policy.refundEligibility,
    refundStatus: policy.refundStatus,
    cancellationOutcome: policy.outcome,
  });
}
