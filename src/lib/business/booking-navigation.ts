// @polsia:user-owned — stable public booking destinations for homepage CTAs.

const BOOKING_HREFS: Record<string, string> = {
  'Basic Cleaning': '/book?service=basicResidential',
  'One-time residential': '/book?service=oneTimeResidential',
  'Recurring residential': '/book?service=recurringResidential',
  'Specialty scope': '/book?service=deepCleaning',
};

export function bookingHrefForPlan(planName: string): string {
  return BOOKING_HREFS[planName] ?? '/book';
}
