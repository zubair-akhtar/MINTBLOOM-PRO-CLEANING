// @polsia:user-owned — static SEO shell; calculator lives in the client island.
import type { Metadata } from 'next';
import { PricingCalculator } from '@/components/custom/pricing-calculator';

export const metadata: Metadata = {
  title: 'Cleaning estimate | Mintbloom',
  description:
    'Get an instant residential cleaning estimate for Lubbock-area homes, or request a quote for larger and commercial jobs.',
  alternates: { canonical: '/book' },
};

export default function BookPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page mx-auto max-w-6xl py-section-lg pb-28 lg:pb-section-lg">
        <PricingCalculator />
      </div>
    </main>
  );
}
