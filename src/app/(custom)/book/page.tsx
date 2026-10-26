// @polsia:user-owned — SEO shell; pass active rate-card bases so /book never flashes defaults.
import type { Metadata } from 'next';
import { PricingCalculator } from '@/components/custom/pricing-calculator';
import { formatUsdFromCents } from '@/lib/business/pricing/money';
import { getActivePricingSettings } from '@/lib/business/pricing/store';

export const dynamic = 'force-dynamic';

export const metadata: Metadata = {
  title: 'Cleaning estimate | Mintbloom',
  description:
    'Get an instant residential cleaning estimate for Lubbock-area homes, or request a quote for larger and commercial jobs.',
  alternates: { canonical: '/book' },
};

export default async function BookPage() {
  let initialRateCard: {
    version: number;
    serviceHints: Record<string, string>;
  } | null = null;

  try {
    const { version, settings } = await getActivePricingSettings();
    const serviceHints: Record<string, string> = {};
    for (const id of ['standard', 'deep', 'move', 'airbnb'] as const) {
      serviceHints[id] = `From ${formatUsdFromCents(settings.services[id].baseCents)}`;
    }
    serviceHints.commercial = 'Walkthrough';
    serviceHints.postConstruction = 'Quote';
    initialRateCard = { version, serviceHints };
  } catch {
    initialRateCard = null;
  }

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page mx-auto max-w-6xl py-section-lg pb-28 lg:pb-section-lg">
        <PricingCalculator initialRateCard={initialRateCard} />
      </div>
    </main>
  );
}
