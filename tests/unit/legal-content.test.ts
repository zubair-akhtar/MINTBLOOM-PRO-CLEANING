// @polsia:user-owned — regression checks for the exact fetched legal source copy.
import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { privacyText } from '@/lib/legal/privacy';
import { termsText } from '@/lib/legal/terms';
import { navItems } from '@/lib/nav';

function sha256(value: string): string {
  return createHash('sha256').update(value, 'utf8').digest('hex');
}

describe('Mintbloom legal source text', () => {
  it('preserves every byte of the fetched LEGAL-02 terms source', () => {
    expect(sha256(termsText)).toBe('fa6b02189c19c31b8de22e083b7ed429e0ee554b990a44d98226947c31439542');
    expect(termsText).toContain('Thank you for choosing Mintbloomproclean. We appreciate the opportunity to provide reliable, professional cleaning services');
    expect(termsText.match(/^\d+\. .+$/gm)).toHaveLength(21);
  });

  it('preserves every byte of the fetched LEGAL-03 privacy source', () => {
    expect(sha256(privacyText)).toBe('1b991d5a0fb069519e54534fafb13ebffaff56e7b664add918726bfd39940ff6');
    expect(privacyText).toContain('We do not sell customer personal information.');
    expect(privacyText.match(/^\d+\. .+$/gm)).toHaveLength(15);
  });

  it('places the public legal routes in the requested footer positions', () => {
    expect(navItems).toContainEqual({
      label: 'Terms',
      href: '/terms',
      group: 'footer',
      order: 4,
    });
    expect(navItems).toContainEqual({
      label: 'Privacy',
      href: '/privacy',
      group: 'footer',
      order: 5,
    });
  });
});
