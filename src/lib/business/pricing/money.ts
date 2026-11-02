// @polsia:user-owned — integer-cent money formatting and rounding.
export function roundHalfUp(numerator: number, denominator: number): number {
  if (!Number.isFinite(numerator) || numerator < 0 || denominator <= 0)
    throw new RangeError('Money rounding expects non-negative values and a positive denominator.');
  return Math.floor((numerator + denominator / 2) / denominator);
}

export function formatUsdFromCents(cents: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    minimumFractionDigits: 0,
    maximumFractionDigits: 2,
  }).format(cents / 100);
}
