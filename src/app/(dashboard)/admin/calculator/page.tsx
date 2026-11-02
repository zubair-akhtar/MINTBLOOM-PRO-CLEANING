// @polsia:user-owned — admin rate-card editor; authorization lives in the shell and APIs.
import type { Metadata } from 'next';
import { PricingRateCardEditor } from '@/components/custom/pricing-rate-card-editor';

export const metadata: Metadata = {
  title: 'Calculator rates | Mintbloom Pro',
  description: 'Edit the versioned rate card used by the public cleaning estimator.',
  robots: { index: false, follow: false },
};

export default function PricingCalculatorAdminPage() {
  return <PricingRateCardEditor />;
}
