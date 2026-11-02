// @polsia:user-owned — PayPal booking return / confirmation page.
import type { Metadata } from 'next';
import Link from 'next/link';
import { Suspense } from 'react';
import { BookingPaymentConfirmation } from '@/components/custom/booking-payment-confirmation';

export const metadata: Metadata = {
  title: 'Booking payment confirmation',
  description: 'Check the payment status for your Mintbloom booking.',
  alternates: { canonical: '/book/confirmed' },
};

export default function BookingConfirmedPage() {
  return (
    <main className="container-page mx-auto flex min-h-[60vh] max-w-3xl items-center justify-center py-section-lg">
      <section className="w-full rounded-3xl border border-border bg-card p-7 shadow-sm sm:p-10">
        <p className="text-eyebrow text-primary">Mintbloom booking</p>
        <h1 className="mt-3 text-h2">Payment confirmation</h1>
        <Suspense fallback={<p className="mt-4 text-muted-foreground">Checking your payment…</p>}>
          <BookingPaymentConfirmation />
        </Suspense>
        <Link
          href="/"
          className="mt-8 inline-flex text-sm font-medium text-primary underline-offset-4 hover:underline"
        >
          Return to Mintbloom
        </Link>
      </section>
    </main>
  );
}
