// @polsia:user-owned — static SEO shell; booking data lives in the client island.
import type { Metadata } from 'next';
import { Suspense } from 'react';
import { BookingForm } from '@/components/custom/booking-form';

export const metadata: Metadata = {
  title: 'Request a Mintbloom quote',
  description:
    'Share your cleaning service and property details for a human-reviewed customized quote.',
  alternates: { canonical: '/book' },
};

export default function BookPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page mx-auto max-w-5xl py-section-lg">
        <Suspense fallback={null}>
          <BookingForm />
        </Suspense>
      </div>
    </main>
  );
}
