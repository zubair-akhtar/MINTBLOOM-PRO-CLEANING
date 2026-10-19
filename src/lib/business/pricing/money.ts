// @polsia:user-owned — half-up cent rounding for pricing estimates.

/** Round a dollar amount to cents using half-up (bankers not used). */
export function dollarsToCents(amount: number): number {
  return Math.round(amount * 100 + Number.EPSILON);
}

/** Round a cents value that may be fractional (e.g. rate * qty) half-up to whole cents. */
export function roundCents(value: number): number {
  return Math.round(value + Number.EPSILON);
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(cents / 100);
}
