import { describe, expect, it } from 'vitest';
import { CareersApplicationInput, CareersResponse } from '@/lib/contracts/careers';

describe('careers contracts', () => {
  it('allows an honest no-current-openings response with market options', () => {
    const response = CareersResponse.parse({
      openings: [],
      markets: [{ id: 'market_lubbock', name: 'Lubbock', city: 'Lubbock', state: 'TX' }],
    });

    expect(response.openings).toHaveLength(0);
    expect(response.markets[0]?.city).toBe('Lubbock');
  });

  it('requires consent and the core applicant fields', () => {
    const result = CareersApplicationInput.safeParse({
      fullName: 'Taylor Cleaner',
      email: 'taylor@example.com',
      roleInterest: 'Cleaner',
      availability: 'Weekday mornings',
      consent: false,
    });

    expect(result.success).toBe(false);
  });
});
