import { describe, expect, it } from 'vitest';
import { rescheduleConfirmationEmail } from '@/lib/email/templates';

describe('reschedule confirmation email', () => {
  const previousServiceDate = new Date('2026-09-20T00:00:00.000Z');
  const nextServiceDate = new Date('2026-10-20T00:00:00.000Z');

  it.each([
    ['weekly', 'Weekly visits keep their weekday rhythm.'],
    ['biweekly', 'Biweekly visits keep their weekday rhythm.'],
    ['monthly', 'Monthly visits keep their calendar day.'],
  ] as const)('uses the saved %s cadence caveat', (cadence, scheduleNote) => {
    const email = rescheduleConfirmationEmail({
      serviceLabel: 'Recurring residential clean',
      cadence,
      previousServiceDate,
      nextServiceDate,
    });

    expect(email.subject).toBe('Your Mintbloom recurring clean was rescheduled');
    expect(email.text).toContain('Service: Recurring residential clean');
    expect(email.text).toContain('Original visit date: September 20, 2026');
    expect(email.text).toContain('New visit date: October 20, 2026');
    expect(email.text).toContain(scheduleNote);
    expect(email.text).toContain('at least 24 hours before the scheduled visit');
  });
});
