// @polsia:user-owned — public navigation regression coverage.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { bookingHrefForPlan } from '@/lib/business/booking-navigation';
import { faqContent } from '@/lib/faq/content';
import { navItems } from '@/lib/nav';

const homepageSource = readFileSync(
  resolve(process.cwd(), 'src/components/custom/homepage.tsx'),
  'utf8',
);
const siteNavSource = readFileSync(
  resolve(process.cwd(), 'src/components/custom/site-nav.tsx'),
  'utf8',
);

describe('Mintbloom public navigation', () => {
  it('keeps the public top row concise and groups project services', () => {
    const primary = navItems.filter((item) => item.group === 'primary');
    const slots = new Set(
      primary.map((item) => (item.menu ? 'menu:' + item.menu : item.href)),
    );

    expect(slots.size).toBeLessThanOrEqual(5);
    expect(primary.filter((item) => item.menu === 'Project cleaning').map((item) => item.href)).toEqual(
      ['/specialty-cleaning', '/builders'],
    );
    expect(primary.find((item) => item.href === '/manage')?.requiresAuth).toBe(true);
  });

  it('points retained homepage fragment links to rendered sections', () => {
    const renderedIds = new Set(
      [...homepageSource.matchAll(/\bid="([^"]+)"/g)].map((match) => match[1]),
    );
    const fragments = navItems
      .map((item) => item.href)
      .filter((href) => href.startsWith('/#'))
      .map((href) => href.slice(2));

    expect(fragments.length).toBeGreaterThan(0);
    for (const fragment of fragments) expect(renderedIds.has(fragment)).toBe(true);
    expect(navItems.some((item) => /#(?:privacy|terms|areas)$/.test(item.href))).toBe(false);
  });

  it('keeps booking reachable from home, FAQ, and mobile navigation', () => {
    expect(navItems.some((item) => item.group === 'secondary' && item.href === '/book')).toBe(true);
    expect(faqContent.cta).toEqual({ label: 'Book a clean', href: '/book' });
    expect(homepageSource).toContain('href="/book"');
    expect(siteNavSource).toContain('href="/book"');
    expect(siteNavSource).toContain('aria-label="Mobile"');
    expect(siteNavSource).toContain('slots.map');
  });

  it('keeps each services CTA on the booking flow with its service context', () => {
    expect(bookingHrefForPlan('One-time residential')).toBe(
      '/book?service=oneTimeResidential',
    );
    expect(bookingHrefForPlan('Recurring residential')).toBe(
      '/book?service=recurringResidential',
    );
    expect(bookingHrefForPlan('Specialty scope')).toBe('/book?service=deepCleaning');
    expect(bookingHrefForPlan('Unrecognized service')).toBe('/book');
    expect(homepageSource).toContain('href={bookingHrefForPlan(plan.name)}');
    expect(homepageSource).not.toContain('disabled={');
  });

  it('lists the service-area page in the public footer navigation', () => {
    expect(navItems).toContainEqual({
      label: 'Service areas',
      href: '/areas',
      group: 'footer',
      order: 2,
    });
  });
});
