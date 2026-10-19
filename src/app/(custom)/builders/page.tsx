// @polsia:user-owned — builders/developers SEO shell; the inquiry form is a client island.
import type { Metadata } from 'next';
import { BuilderInquiryForm } from '@/components/custom/builder-inquiry-form';

export const metadata: Metadata = {
  title: 'Builder and developer cleaning bids',
  description:
    'Send Mintbloom a complete multi-unit project brief and receive a budgetary per-unit range for rough, final, and punch-list cleaning.',
  alternates: { canonical: '/builders' },
};

export default function BuildersPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page mx-auto max-w-6xl py-section-lg">
        <BuilderInquiryForm />
      </div>
    </main>
  );
}
