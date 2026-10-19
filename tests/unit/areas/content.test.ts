// @polsia:user-owned — service-area content regression coverage.
import { describe, expect, it } from 'vitest';
import {
  areaAvailabilityNote,
  areaRequestNotice,
  coverageRules,
  texasMarkets,
} from '@/lib/business/service-areas';

describe('Texas service-area content', () => {
  it('lists the requested markets and a generic label for additional Texas locations', () => {
    expect(texasMarkets).toEqual([
      'Lubbock',
      'New Deal',
      'Wolfforth',
      'Plains',
      'Houston',
      'Dallas',
      'Austin',
      'Additional Texas markets—request availability',
    ]);
  });

  it('explains ZIP-based core, nearby, and extended review without assigning cities to tiers', () => {
    expect(coverageRules.map((rule) => rule.id)).toEqual(['core', 'nearby', 'extended']);
    expect(coverageRules[0].description).toContain('Lubbock core ZIP codes');
    expect(coverageRules[1].description).toContain('Approved nearby ZIP codes');
    expect(coverageRules[1].description).toContain('Recurring work');
    expect(coverageRules[2].description).toContain('travel and scope review before a quote');
    expect(areaAvailabilityNote).toContain('city name alone does not confirm availability');
    expect(areaAvailabilityNote).toContain('service ZIP and requested scope');
  });

  it('uses a receipt that does not confirm service or a booking', () => {
    expect(areaRequestNotice).toBe(
      'Request received. We’ll review the location and scope; this does not confirm service availability or a booking.',
    );
  });
});
