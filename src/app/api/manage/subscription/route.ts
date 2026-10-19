// @polsia:user-owned — authenticated subscriber projection and policy action.
import 'server-only';

import { NextResponse } from 'next/server';
import {
  type CancellationResult,
  calculateCancellationPolicy,
  cancellationResultFromStored,
  cancelSubscriptionForOwner,
  SubscriptionNotFoundError,
} from '@/lib/business/subscription-cancellation';
import {
  RescheduleConflictError,
  RescheduleNotFoundError,
  ReschedulePolicyError,
  rescheduleSubscriptionForOwner,
  subscriptionOwnerWhere,
} from '@/lib/business/subscription-rescheduling';
import {
  ManageSubscriptionRequest,
  ManageSubscriptionResponse,
} from '@/lib/contracts/manage-subscription';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { rescheduleConfirmationEmail } from '@/lib/email/templates';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

function projection(booking: {
  id: string;
  tier: 'weekly' | 'biweekly' | 'monthly';
  cadence: 'weekly' | 'biweekly' | 'monthly' | null;
  serviceDate: Date;
  paymentAmountCents: number;
  status: 'active' | 'paused';
}) {
  const policy = calculateCancellationPolicy({
    serviceDate: booking.serviceDate,
    paymentAmountCents: booking.paymentAmountCents,
    cancelledAt: new Date(),
  });
  return {
    id: booking.id,
    tier: booking.tier,
    cadence: booking.cadence ?? booking.tier,
    nextScheduledVisit: booking.serviceDate.toISOString().slice(0, 10),
    cancellationCutoffAt: policy.cutoffAt.toISOString(),
    paidAmountCents: booking.paymentAmountCents,
    refundEligibility: policy.refundEligibility,
    status: booking.status,
  };
}

async function findSubscription(email: string) {
  return prisma.booking.findFirst({
    where: subscriptionOwnerWhere(email),
    orderBy: { serviceDate: 'asc' },
    select: {
      id: true,
      tier: true,
      cadence: true,
      serviceDate: true,
      paymentAmountCents: true,
      status: true,
    },
  });
}

async function findLatestCancellation(email: string) {
  return prisma.booking.findFirst({
    where: {
      email: { equals: normalizedEmail(email), mode: 'insensitive' },
      serviceType: 'recurringResidential',
      paymentAmountCents: { gt: 0 },
      status: 'paused',
      cancelledAt: { not: null },
      cancellationAction: { not: null },
    },
    orderBy: { cancelledAt: 'desc' },
    select: {
      cancellationAction: true,
      serviceDate: true,
      cancelledAt: true,
      paymentAmountCents: true,
      refundEligibility: true,
      refundStatus: true,
      cancellationOutcome: true,
    },
  });
}

function cancellationResponse(result: CancellationResult) {
  return {
    action: result.action,
    scheduledServiceDate: result.scheduledServiceDate,
    cutoffAt: result.cutoffAt,
    refundEligibility: result.refundEligibility,
    refundStatus: result.refundStatus,
    outcome: result.outcome,
    message: result.message,
  };
}

async function responseFor(email: string) {
  const [booking, cancellation] = await Promise.all([
    findSubscription(email),
    findLatestCancellation(email),
  ]);
  const cancellationResult =
    cancellation?.cancellationAction && cancellation.cancelledAt
      ? cancellationResultFromStored({
          action: cancellation.cancellationAction === 'cancel' ? 'cancel' : 'pause',
          serviceDate: cancellation.serviceDate,
          cancelledAt: cancellation.cancelledAt,
          paymentAmountCents: cancellation.paymentAmountCents,
          refundEligibility: cancellation.refundEligibility,
          refundStatus: cancellation.refundStatus,
          cancellationOutcome: cancellation.cancellationOutcome,
        })
      : null;
  return ManageSubscriptionResponse.parse({
    subscription: booking ? projection(booking) : null,
    cancellation: cancellationResult,
  });
}

async function authenticatedUser(request: Request): Promise<SessionUser | Response> {
  try {
    const user = await requireAuth(request);
    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }
    return user;
  } catch (response) {
    return response as Response;
  }
}

export async function GET(request: Request) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  try {
    return NextResponse.json(await responseFor(authenticated.email));
  } catch {
    return NextResponse.json({ error: 'Could not load subscription' }, { status: 500 });
  }
}

export async function PATCH(request: Request) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  const parsed = ManageSubscriptionRequest.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json(
      { error: 'A pause or cancel action and booking id are required', code: 'invalid_request' },
      { status: 400 },
    );
  }

  if (parsed.data.action === 'reschedule') {
    try {
      const booking = await rescheduleSubscriptionForOwner({
        email: authenticated.email,
        bookingId: parsed.data.bookingId,
        targetDate: parsed.data.targetDate,
      });
      const response = ManageSubscriptionResponse.parse({
        subscription: projection(booking),
        cancellation: null,
        reschedule: {
          action: 'reschedule',
          bookingId: booking.id,
          previousServiceDate: booking.previousServiceDate.toISOString().slice(0, 10),
          nextScheduledVisit: booking.serviceDate.toISOString().slice(0, 10),
        },
      });
      try {
        await sendEmail({
          to: authenticated.email,
          ...rescheduleConfirmationEmail({
            serviceLabel: 'Recurring residential clean',
            cadence: booking.cadence ?? booking.tier,
            previousServiceDate: booking.previousServiceDate,
            nextServiceDate: booking.serviceDate,
          }),
        });
      } catch {
        process.emitWarning('Reschedule confirmation email failed after the booking was updated.', {
          code: 'RESCHEDULE_CONFIRMATION_EMAIL_FAILED',
        });
      }
      return NextResponse.json(response);
    } catch (error) {
      if (error instanceof ReschedulePolicyError) {
        return NextResponse.json(
          { error: 'That date is not available for rescheduling.', code: error.code },
          { status: 400 },
        );
      }
      if (error instanceof RescheduleNotFoundError) {
        return NextResponse.json(
          { error: 'Subscription not found', code: 'subscription_not_found' },
          { status: 404 },
        );
      }
      if (error instanceof RescheduleConflictError) {
        return NextResponse.json(
          {
            error: 'Your service changed before it could be rescheduled.',
            code: 'reschedule_conflict',
          },
          { status: 409 },
        );
      }
      return NextResponse.json({ error: 'Could not reschedule subscription' }, { status: 500 });
    }
  }

  try {
    const result = await cancelSubscriptionForOwner({
      email: authenticated.email,
      bookingId: parsed.data.bookingId,
      action: parsed.data.action,
    });
    return NextResponse.json(
      ManageSubscriptionResponse.parse({
        subscription: null,
        cancellation: cancellationResponse(result),
      }),
    );
  } catch (error) {
    if (error instanceof SubscriptionNotFoundError) {
      return NextResponse.json({ error: 'Subscription not found' }, { status: 404 });
    }
    return NextResponse.json({ error: 'Could not update subscription' }, { status: 500 });
  }
}
