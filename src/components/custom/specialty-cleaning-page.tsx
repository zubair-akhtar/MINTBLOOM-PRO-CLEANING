// @polsia:user-owned — client island for the typed specialty-cleaning catalog.
'use client';

import {
  ArrowRight,
  Check,
  Clock3,
  LoaderCircle,
  MapPin,
  ShieldCheck,
  Sparkles,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import type { BookingOptionsResponse as BookingOptions } from '@/lib/contracts/bookings';
import { BookingOptionsResponse } from '@/lib/contracts/bookings';

const SPECIALTY_IDS = ['postConstruction', 'moveInMoveOut', 'medicalGradeSanitation'] as const;

export function SpecialtyCleaningPage() {
  const [options, setOptions] = useState<BookingOptions | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/bookings/options', { schema: BookingOptionsResponse })
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch(() => {
        if (active) setError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (error) {
    return (
      <main className="container-page py-section-lg">
        <Card className="mx-auto max-w-2xl border-destructive/30">
          <CardContent className="p-10 text-center text-body text-destructive">
            We could not load the specialty menu. Please refresh and try again.
          </CardContent>
        </Card>
      </main>
    );
  }
  if (!options) {
    return (
      <main className="container-page grid min-h-[65vh] place-items-center py-section-lg">
        <div className="flex items-center gap-3 text-body text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
          Loading specialty scopes…
        </div>
      </main>
    );
  }

  const services = SPECIALTY_IDS.map((id) => options.services.find((service) => service.id === id));
  if (services.some((service) => !service)) {
    return (
      <main className="container-page py-section-lg">
        <Card className="mx-auto max-w-2xl border-destructive/30">
          <CardContent className="p-10 text-center text-body text-destructive">
            The specialty menu is being updated. Please try again shortly.
          </CardContent>
        </Card>
      </main>
    );
  }

  const resolvedServices = services.filter(
    (service): service is BookingOptions['services'][number] => Boolean(service),
  );

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <section className="container-page grid gap-12 py-section-lg lg:grid-cols-[1.05fr_0.95fr] lg:items-end">
        <div className="flex flex-col gap-6">
          <Badge
            variant="outline"
            className="w-fit gap-2 border-brand-200 px-3 py-1 text-brand-700 dark:border-brand-700 dark:text-brand-300"
          >
            <Sparkles className="size-3.5" aria-hidden /> Specialty scopes, clearly reviewed
          </Badge>
          <h1 className="max-w-4xl font-display text-display tracking-tight">
            The clean between <span className="text-primary">milestones.</span>
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            Turnovers, handovers, and sanitation-focused spaces need more context than a generic
            checklist. Choose the scope that fits, share the ZIP and property details, and Mintbloom
            will route the request for a human-reviewed quote.
          </p>
          <div className="flex flex-wrap gap-3">
            <Button asChild size="lg" className="gap-2 shadow-brand">
              <Link href="/book?service=postConstruction">
                Request a specialty quote <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg">
              <Link href="/builders">Planning a multi-unit project?</Link>
            </Button>
          </div>
        </div>
        <Card className="border-primary/15 bg-card/80 shadow-lg">
          <CardContent className="grid gap-5 p-6 sm:grid-cols-2 lg:grid-cols-1">
            <TrustNote
              icon={<MapPin className="size-4" aria-hidden />}
              title="Area-aware"
              text="ZIP and state determine core, nearby, or extended travel review on the server."
            />
            <TrustNote
              icon={<Clock3 className="size-4" aria-hidden />}
              title="Timing-aware"
              text="Dates are discussed alongside site readiness, handover, and inspection milestones."
            />
            <TrustNote
              icon={<ShieldCheck className="size-4" aria-hidden />}
              title="Claim-safe care"
              text="Registered LLC, bonded, and covered by general liability insurance."
            />
          </CardContent>
        </Card>
      </section>

      <section className="border-y border-border bg-muted/35 py-section">
        <div className="container-page grid gap-5 lg:grid-cols-3">
          {resolvedServices.map((service) => (
            <Card
              key={service.id}
              className="group flex h-full flex-col border-primary/10 transition-transform hover:-translate-y-1 hover:shadow-lg"
            >
              <CardHeader className="gap-3 p-6">
                <div className="flex items-start justify-between gap-4">
                  <CardTitle className="font-display text-h3">{service.label}</CardTitle>
                  <Badge variant="secondary">Quote review</Badge>
                </div>
                <CardDescription className="text-body">{service.shortDescription}</CardDescription>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-5 p-6 pt-0">
                <div className="flex flex-col gap-2 text-small text-muted-foreground">
                  {service.inclusions.map((item) => (
                    <p key={item} className="flex items-start gap-2">
                      <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden /> {item}
                    </p>
                  ))}
                </div>
                <p className="text-caption text-muted-foreground">
                  Not included: {service.exclusions.join(' · ')}
                </p>
                <Button
                  asChild
                  variant="outline"
                  className="mt-auto w-full justify-between group-hover:border-primary"
                >
                  <Link href={`/book?service=${service.id}`}>
                    Choose this scope <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </section>

      <section className="container-page grid gap-8 py-section lg:grid-cols-2">
        <div>
          <p className="text-eyebrow text-primary">Scheduling reality</p>
          <h2 className="mt-2 font-display text-h2">Final clean timing follows readiness.</h2>
          <p className="mt-4 text-body-lg text-muted-foreground">
            A final clean can usually be scheduled 24–48 hours before handover or move-in only after
            major construction is complete, trades are finished, utilities are on, and heavy debris
            has been removed. The requested move-in date and cleaning date belong in the same
            review.
          </p>
        </div>
        <div className="grid gap-4">
          <TimingCard
            title="Earlier rough clean"
            text="Use an earlier pass to reduce construction residue before the final turnover window."
          />
          <TimingCard
            title="Final clean"
            text="Schedule near handover once the property is ready for detail work and final surfaces."
          />
          <TimingCard
            title="Punch-list re-clean"
            text="Return after inspection for the items that emerge in the handover review."
          />
        </div>
      </section>

      <section className="container-page border-t border-border py-8 text-small text-muted-foreground">
        {options.areaNotes.core} {options.areaNotes.nearby} {options.areaNotes.extended} Travel
        charges and access conditions are confirmed as part of the quote review.
      </section>
    </main>
  );
}

function TrustNote({ icon, title, text }: { icon: React.ReactNode; title: string; text: string }) {
  return (
    <div className="flex gap-3">
      <div className="mt-0.5 text-primary">{icon}</div>
      <div>
        <p className="text-small font-semibold">{title}</p>
        <p className="mt-1 text-caption text-muted-foreground">{text}</p>
      </div>
    </div>
  );
}

function TimingCard({ title, text }: { title: string; text: string }) {
  return (
    <Card className="border-primary/10">
      <CardContent className="p-5">
        <p className="text-small font-semibold text-foreground">{title}</p>
        <p className="mt-1 text-small text-muted-foreground">{text}</p>
      </CardContent>
    </Card>
  );
}
