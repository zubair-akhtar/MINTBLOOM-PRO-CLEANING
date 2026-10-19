// @polsia:user-owned — public service-area information and request intake.

import { ArrowRight, MapPin } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { ContactActions } from '@/components/custom/contact-actions';
import { ContactForm } from '@/components/custom/contact-form';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';
import {
  areaAvailabilityNote,
  areaRequestNotice,
  coverageRules,
  texasMarkets,
} from '@/lib/business/service-areas';

export const metadata: Metadata = {
  title: 'Texas Service Areas',
  description:
    'Explore Mintbloom Pro’s Texas markets and ZIP-based core, nearby, and extended-area rules, then request availability for your address.',
  alternates: { canonical: '/areas' },
};

export default function AreasPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page flex flex-col gap-16 py-section-lg sm:gap-20">
        <header className="grid gap-8 lg:grid-cols-[1.15fr_0.85fr] lg:items-end lg:gap-14">
          <div className="flex flex-col items-start gap-5">
            <p className="text-eyebrow text-primary">Availability by ZIP</p>
            <h1 className="font-display text-display tracking-tight text-foreground">
              Texas Service Areas
            </h1>
            <p className="max-w-2xl text-body-lg text-muted-foreground">
              Mintbloom Pro accepts service requests across Texas. We review the service address and
              requested scope to determine whether it fits the core, nearby, or extended-area rules.
            </p>
            <Button asChild size="lg" className="mt-1 gap-2">
              <Link href="#request-area">
                Request your area <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <Card className="border-primary/15 bg-card/90 shadow-md">
            <CardContent className="flex flex-col gap-3 p-6 sm:p-7">
              <p className="text-eyebrow text-primary">How availability works</p>
              <p className="text-body text-foreground">{areaAvailabilityNote}</p>
              <p className="text-small text-muted-foreground">
                The markets below are places to request availability, not a promise of service in
                every ZIP code.
              </p>
            </CardContent>
          </Card>
        </header>

        <section aria-labelledby="markets-heading" className="flex flex-col gap-6">
          <div className="max-w-2xl">
            <p className="text-eyebrow text-primary">Texas markets to request</p>
            <h2 id="markets-heading" className="mt-2 font-display text-h2 text-foreground">
              Tell us where you need service.
            </h2>
            <p className="mt-3 text-body text-muted-foreground">
              These cities and other Texas locations are welcome to send an availability request.
              Your ZIP code and service details determine the next step.
            </p>
          </div>
          <ul className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            {texasMarkets.map((market) => (
              <li
                key={market}
                className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-card px-4 py-3 shadow-xs"
              >
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <MapPin className="size-4" aria-hidden />
                </span>
                <span className="text-small font-semibold text-foreground">{market}</span>
              </li>
            ))}
          </ul>
          <p className="max-w-3xl text-small text-muted-foreground">{areaAvailabilityNote}</p>
        </section>

        <section aria-labelledby="coverage-heading" className="flex flex-col gap-6">
          <div className="max-w-2xl">
            <p className="text-eyebrow text-primary">ZIP-based coverage</p>
            <h2 id="coverage-heading" className="mt-2 font-display text-h2 text-foreground">
              Three ways we review an address.
            </h2>
          </div>
          <div className="grid items-stretch gap-4 lg:grid-cols-3">
            {coverageRules.map((rule, index) => (
              <Card key={rule.id} className="h-full border-border bg-card/90">
                <CardContent className="flex h-full flex-col gap-5 p-6 sm:p-7">
                  <span className="grid size-10 place-items-center rounded-full bg-primary/10 text-small font-bold text-primary">
                    0{index + 1}
                  </span>
                  <div className="flex flex-col gap-2">
                    <h3 className="font-display text-h3 text-foreground">{rule.title}</h3>
                    <p className="text-body text-muted-foreground">{rule.description}</p>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          <p className="max-w-3xl rounded-xl border border-border bg-muted/40 px-5 py-4 text-small text-muted-foreground">
            No travel fee or availability is confirmed by this page. Addresses outside the approved
            ZIP lists are reviewed for travel and scope before a quote.
          </p>
        </section>

        <section
          id="request-area"
          aria-labelledby="request-heading"
          className="scroll-mt-24 rounded-3xl border border-primary/15 bg-brand-50/45 p-5 dark:bg-brand-900/10 sm:p-8 lg:p-10"
        >
          <div className="grid gap-8 lg:grid-cols-[0.85fr_1.15fr] lg:gap-12">
            <div className="flex flex-col items-start gap-4">
              <p className="text-eyebrow text-primary">Area request</p>
              <h2 id="request-heading" className="font-display text-h2 text-foreground">
                Request your area
              </h2>
              <p className="text-body text-muted-foreground">
                Include your Texas city, ZIP code, desired service, and useful scope details in your
                message so we can review the right address and work.
              </p>
              <p className="rounded-xl border border-border bg-background/80 p-4 text-small text-foreground">
                {areaRequestNotice}
              </p>
              <ContactActions />
            </div>
            <Card className="border-border bg-card shadow-sm">
              <CardContent className="p-5 sm:p-7">
                <ContactForm />
              </CardContent>
            </Card>
          </div>
        </section>
      </div>
    </main>
  );
}
