// @polsia:user-owned — server-only subscriber rescheduling policy and persistence.
import 'server-only';

import { prisma } from '@/lib/db';

export const RESCHEDULING_WINDOW_HOURS = 24;

type Cadence = 'weekly' | 'biweekly' | 'monthly';

export type ReschedulePolicyCode =
  | 'invalid_date'
  | 'date_not_in_future'
  | 'same_date'
  | 'cadence_mismatch'
  | 'cutoff_passed';

export class ReschedulePolicyError extends Error {
  readonly code: ReschedulePolicyCode;

  constructor(code: ReschedulePolicyCode) {
    super(code);
    this.name = 'ReschedulePolicyError';
    this.code = code;
  }
}

export class RescheduleNotFoundError extends Error {
  constructor() {
    super('Subscription not found');
    this.name = 'RescheduleNotFoundError';
  }
}

export class RescheduleConflictError extends Error {
  constructor() {
    super('Subscription changed before it could be rescheduled');
    this.name = 'RescheduleConflictError';
  }
}

function normalizedEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function startOfUtcDay(now = new Date()): Date {
  return new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate()));
}

export function subscriptionOwnerWhere(email: string, now = new Date()) {
  return {
    email: { equals: normalizedEmail(email), mode: 'insensitive' as const },
    serviceType: 'recurringResidential' as const,
    paymentAmountCents: { gt: 0 },
    status: 'active' as const,
    serviceDate: { gte: startOfUtcDay(now) },
  };
}

function parseUtcCalendarDate(value: string): Date | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime()) || date.toISOString().slice(0, 10) !== value) return null;
  return date;
}

function normalizedDate(date: Date): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function daysBetween(left: Date, right: Date): number {
  return Math.round((normalizedDate(right).getTime() - normalizedDate(left).getTime()) / 86400000);
}

function cadenceCompatible(current: Date, target: Date, cadence: Cadence): boolean {
  const distance = Math.abs(daysBetween(current, target));
  if (cadence === 'weekly') return distance > 0 && distance % 7 === 0;
  if (cadence === 'biweekly') return distance > 0 && distance % 14 === 0;

  return (
    current.getUTCDate() === target.getUTCDate() &&
    current.getUTCFullYear() * 12 + current.getUTCMonth() !==
      target.getUTCFullYear() * 12 + target.getUTCMonth()
  );
}

export function validateReschedulePolicy(input: {
  currentServiceDate: Date;
  targetDate: string;
  cadence: Cadence;
  now: Date;
}): { targetDate: Date; cutoffAt: Date } {
  const targetDate = parseUtcCalendarDate(input.targetDate);
  if (!targetDate) throw new ReschedulePolicyError('invalid_date');

  const currentServiceDate = normalizedDate(input.currentServiceDate);
  const today = startOfUtcDay(input.now);
  if (targetDate.getTime() <= today.getTime()) {
    throw new ReschedulePolicyError('date_not_in_future');
  }
  if (targetDate.getTime() === currentServiceDate.getTime()) {
    throw new ReschedulePolicyError('same_date');
  }

  const cutoffAt = new Date(
    currentServiceDate.getTime() - RESCHEDULING_WINDOW_HOURS * 60 * 60 * 1000,
  );
  if (input.now.getTime() > cutoffAt.getTime()) {
    throw new ReschedulePolicyError('cutoff_passed');
  }
  if (!cadenceCompatible(currentServiceDate, targetDate, input.cadence)) {
    throw new ReschedulePolicyError('cadence_mismatch');
  }

  return { targetDate, cutoffAt };
}

export async function rescheduleSubscriptionForOwner(input: {
  email: string;
  bookingId: string;
  targetDate: string;
  now?: Date;
}) {
  const now = input.now ?? new Date();
  const email = normalizedEmail(input.email);
  const booking = await prisma.booking.findFirst({
    where: subscriptionOwnerWhere(email, now),
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

  if (!booking || booking.id !== input.bookingId) {
    throw new RescheduleNotFoundError();
  }

  const cadence = booking.cadence ?? booking.tier;
  const { targetDate } = validateReschedulePolicy({
    currentServiceDate: booking.serviceDate,
    targetDate: input.targetDate,
    cadence,
    now,
  });

  const updated = await prisma.booking.updateMany({
    where: {
      id: booking.id,
      email: { equals: email, mode: 'insensitive' },
      serviceType: 'recurringResidential',
      paymentAmountCents: { gt: 0 },
      status: 'active',
      serviceDate: booking.serviceDate,
    },
    data: { serviceDate: targetDate },
  });

  if (updated.count === 0) throw new RescheduleConflictError();

  return { ...booking, previousServiceDate: booking.serviceDate, serviceDate: targetDate };
}
