import { describe, expect, it } from 'vitest';
import { FaqResponse } from '@/lib/contracts/faq';
import { faqContent } from '@/lib/faq/content';

describe('Mintbloom FAQ content', () => {
  it('publishes exactly the five approved customer questions', () => {
    expect(faqContent.items).toHaveLength(5);
    expect(faqContent.items.map((item) => item.id)).toEqual([
      're-clean-guarantee',
      'eco-products',
      'flat-rate-pricing',
      'scheduling',
      'insurance',
    ]);
    expect(FaqResponse.safeParse({ items: faqContent.items }).success).toBe(true);
  });
});
