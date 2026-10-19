import { describe, expect, it, vi } from 'vitest';

vi.mock('server-only', () => ({}));
vi.mock('@/lib/db', () => ({ prisma: { booking: {} } }));

import { calculateCancellationPolicy } from '@/lib/business/subscription-cancellation';
import {
  ReschedulePolicyError,
  validateReschedulePolicy,
} from '@/lib/business/subscription-rescheduling';

describe('subscription cancellation policy', () => {
  const serviceDate = new Date('2026-09-20T00:00:00.000Z');

  it('treats the exact 24-hour boundary as eligible', () => {
    const result = calculateCancellationPolicy({
      serviceDate,
      paymentAmountCents: 12500,
      cancelledAt: new Date('2026-09-19T00:00:00.000Z'),
    });
    expect(result.refundEligibility).toBe('eligible');
    expect(result.outcome).toBe('refund_unavailable');
  });

  it('treats a cancellation inside 24 hours as late and non-refundable', () => {
    const result = calculateCancellationPolicy({
      serviceDate,
      paymentAmountCents: 12500,
      cancelledAt: new Date('2026-09-19T00:00:00.001Z'),
    });
    expect(result.refundEligibility).toBe('not_eligible');
    expect(result.outcome).toBe('late_cancellation_no_refund');
  });

  it('does not calculate a refund for an unpaid service', () => {
    const result = calculateCancellationPolicy({
      serviceDate,
      paymentAmountCents: 0,
      cancelledAt: new Date('2026-09-18T00:00:00.000Z'),
    });
    expect(result.refundEligibility).toBe('not_applicable');
    expect(result.refundStatus).toBe('not_applicable');
  });

  describe('rescheduling policy', () => {
    const now = new Date('2026-09-12T12:00:00.000Z');
    const currentServiceDate = new Date('2026-09-20T00:00:00.000Z');

    function policy(targetDate: string, cadence: 'weekly' | 'biweekly' | 'monthly', at = now) {
      return () => validateReschedulePolicy({ currentServiceDate, targetDate, cadence, now: at });
    }

    it('accepts real dates that preserve weekly, biweekly, and monthly cadence', () => {
      expect(policy('2026-09-27', 'weekly')).not.toThrow();
      expect(policy('2026-10-04', 'biweekly')).not.toThrow();
      expect(policy('2026-10-20', 'monthly')).not.toThrow();
    });

    it('rejects impossible, past, today, and unchanged dates', () => {
      expect(policy('2026-02-30', 'weekly')).toThrowError(
        new ReschedulePolicyError('invalid_date'),
      );
      expect(policy('2026-09-11', 'weekly')).toThrowError(
        new ReschedulePolicyError('date_not_in_future'),
      );
      expect(policy('2026-09-12', 'weekly')).toThrowError(
        new ReschedulePolicyError('date_not_in_future'),
      );
      expect(policy('2026-09-20', 'weekly', new Date('2026-09-10T12:00:00.000Z'))).toThrowError(
        new ReschedulePolicyError('same_date'),
      );
    });

    it('rejects dates outside the cadence schedule', () => {
      expect(policy('2026-09-28', 'weekly')).toThrowError(
        new ReschedulePolicyError('cadence_mismatch'),
      );
      expect(policy('2026-10-04', 'biweekly')).not.toThrow();
      expect(policy('2026-10-21', 'monthly')).toThrowError(
        new ReschedulePolicyError('cadence_mismatch'),
      );
    });

    it('allows the exact 24-hour boundary and rejects requests after it', () => {
      expect(policy('2026-09-27', 'weekly', new Date('2026-09-19T00:00:00.000Z'))).not.toThrow();
      expect(policy('2026-09-27', 'weekly', new Date('2026-09-19T00:00:00.001Z'))).toThrowError(
        new ReschedulePolicyError('cutoff_passed'),
      );
    });
  });
});
