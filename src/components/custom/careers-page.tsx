// @polsia:user-owned — client island for typed careers listings and application intake.
'use client';

// Design rationale: Mintbloom careers should feel grounded, local, and honest.
// The existing botanical green palette pairs with warm editorial type, while an
// asymmetric intro and quiet paper-like surfaces keep market interest distinct
// from a real posted opening.

import { ArrowRight, BriefcaseBusiness, MapPin, Sprout } from 'lucide-react';
import Link from 'next/link';
import { useEffect, useMemo, useState } from 'react';
import { CareersApplicationForm } from '@/components/custom/careers-application-form';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { apiFetch } from '@/lib/api-client';
import {
  CareersResponse,
  type CareersResponse as CareersResponseValues,
} from '@/lib/contracts/careers';

export function CareersPage() {
  const [data, setData] = useState<CareersResponseValues | null>(null);
  const [loadError, setLoadError] = useState(false);
  const [marketFilter, setMarketFilter] = useState('all');

  useEffect(() => {
    let active = true;
    apiFetch('/api/careers', { schema: CareersResponse })
      .then((result) => {
        if (active) setData(result);
      })
      .catch(() => {
        if (active) setLoadError(true);
      });
    return () => {
      active = false;
    };
  }, []);

  const visibleOpenings = useMemo(
    () =>
      data?.openings.filter(
        (opening) => marketFilter === 'all' || opening.marketId === marketFilter,
      ) ?? [],
    [data, marketFilter],
  );

  if (loadError) {
    return (
      <main className="container-page grid min-h-[60vh] place-items-center py-section-lg">
        <Card className="w-full max-w-xl border-destructive/30 bg-card/90 shadow-lg">
          <CardContent className="p-10 text-center">
            <p className="text-body text-destructive">
              We could not load Mintbloom careers right now. Please refresh and try again.
            </p>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!data) {
    return (
      <main className="container-page grid min-h-[60vh] place-items-center py-section-lg">
        <div className="flex items-center gap-3 text-body text-muted-foreground">
          <Sprout className="size-5 animate-pulse text-primary" aria-hidden />
          Loading Mintbloom careers…
        </div>
      </main>
    );
  }

  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 -z-10 h-[34rem] bg-gradient-to-br from-brand-50 via-background to-background dark:from-brand-950/30"
      />
      <section className="container-page grid gap-10 py-section-lg lg:grid-cols-[1.15fr_0.85fr] lg:items-end">
        <div className="flex max-w-3xl flex-col gap-6">
          <Badge
            variant="outline"
            className="w-fit gap-2 border-brand-200 px-3 py-1 text-brand-700 dark:border-brand-700 dark:text-brand-300"
          >
            <Sprout className="size-3.5" aria-hidden />
            Grow with Mintbloom
          </Badge>
          <h1 className="font-display text-display tracking-tight text-foreground">
            Good work, rooted in <span className="text-primary">good places.</span>
          </h1>
          <p className="max-w-2xl text-body-lg text-muted-foreground">
            We are building local cleaning teams and thoughtful operations support across Texas. See
            only roles Mintbloom has actually posted, or tell us where you would like to grow with
            us next.
          </p>
        </div>
        <Card className="border-primary/15 bg-card/75 shadow-lg backdrop-blur">
          <CardHeader>
            <CardTitle className="font-display text-h3">A clear signal matters</CardTitle>
            <CardDescription>
              A market listed below is an area of interest—not proof that Mintbloom is hiring there
              today.
            </CardDescription>
          </CardHeader>
          <CardContent className="flex items-center gap-3 text-small text-muted-foreground">
            <MapPin className="size-5 shrink-0 text-primary" aria-hidden />
            <span>
              {data.markets.length} Texas markets are currently in the service-market plan.
            </span>
          </CardContent>
        </Card>
      </section>

      <section className="container-page section-lg" aria-labelledby="openings-heading">
        <div className="mb-8 flex flex-col gap-5 border-b border-border pb-6 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="mb-2 text-eyebrow">Posted openings</p>
            <h2 id="openings-heading" className="font-display text-h2">
              Current opportunities
            </h2>
          </div>
          {data.openings.length > 0 && (
            <div className="flex w-full flex-col gap-2 sm:w-64">
              <label
                htmlFor="market-filter"
                className="text-small font-medium text-muted-foreground"
              >
                Filter by market
              </label>
              <Select value={marketFilter} onValueChange={setMarketFilter}>
                <SelectTrigger id="market-filter">
                  <SelectValue placeholder="All markets" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All markets</SelectItem>
                  {data.markets.map((market) => (
                    <SelectItem key={market.id} value={market.id}>
                      {market.city}, {market.state}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}
        </div>

        {visibleOpenings.length === 0 ? (
          <Card className="border-dashed bg-muted/30 shadow-none">
            <CardContent className="flex flex-col items-start gap-4 p-8 sm:p-10">
              <div className="grid size-12 place-items-center rounded-2xl bg-primary/10 text-primary">
                <BriefcaseBusiness className="size-6" aria-hidden />
              </div>
              <div className="flex max-w-2xl flex-col gap-2">
                <h3 className="font-display text-h3">
                  {data.openings.length === 0
                    ? 'No openings are posted today.'
                    : 'No openings in this market yet.'}
                </h3>
                <p className="text-body text-muted-foreground">
                  Mintbloom will publish a role here when the work, schedule, expectations, and
                  compensation are confirmed. You can still share your interest below so the right
                  local opportunity has a place to start.
                </p>
              </div>
              <Button
                asChild
                variant="link"
                className="group w-fit gap-2 p-0 text-small font-semibold"
              >
                <Link href="#apply">
                  Share your interest{' '}
                  <ArrowRight
                    className="size-4 transition-transform group-hover:translate-x-1"
                    aria-hidden
                  />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ) : (
          <div className="grid gap-5 lg:grid-cols-2">
            {visibleOpenings.map((opening) => (
              <Card
                key={opening.id}
                className="group border-primary/10 shadow-md transition-transform duration-200 hover:-translate-y-1 hover:shadow-lg"
              >
                <CardHeader className="gap-4">
                  <div className="flex items-start justify-between gap-4">
                    <Badge className="bg-primary/10 text-primary hover:bg-primary/15">
                      Now hiring
                    </Badge>
                    <span className="text-small text-muted-foreground">
                      {opening.city}, {opening.state}
                    </span>
                  </div>
                  <div>
                    <CardTitle className="font-display text-h3">{opening.title}</CardTitle>
                    <CardDescription className="mt-2">
                      {opening.role} · {opening.employmentArea}
                    </CardDescription>
                  </div>
                </CardHeader>
                <CardContent className="flex flex-col gap-5">
                  <dl className="grid gap-3 text-small sm:grid-cols-2">
                    <div>
                      <dt className="font-semibold text-foreground">Schedule</dt>
                      <dd className="text-muted-foreground">{opening.schedule}</dd>
                    </div>
                    <div>
                      <dt className="font-semibold text-foreground">Compensation</dt>
                      <dd className="text-muted-foreground">
                        {opening.compensation ?? 'Shared during the application process'}
                      </dd>
                    </div>
                  </dl>
                  <div>
                    <h4 className="mb-1 text-small font-semibold text-foreground">
                      What we are looking for
                    </h4>
                    <p className="whitespace-pre-line text-small leading-6 text-muted-foreground">
                      {opening.requirements}
                    </p>
                  </div>
                  <Button
                    asChild
                    variant="link"
                    className="w-fit gap-2 p-0 text-small font-semibold"
                  >
                    <Link href="#apply">
                      Apply for this role <ArrowRight className="size-4" aria-hidden />
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </section>

      <section id="apply" className="border-y border-border bg-muted/35">
        <div className="container-page section-lg grid gap-10 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          <div className="flex flex-col gap-4 lg:sticky lg:top-8">
            <p className="text-eyebrow">Make an introduction</p>
            <h2 className="font-display text-h2">Join the next clean start.</h2>
            <p className="text-body text-muted-foreground">
              Choose a posted opening when one fits. Otherwise, choose a market and tell us about
              the work you want to do. General interest helps us understand where to build next; it
              is not a promise of current hiring.
            </p>
          </div>
          <CareersApplicationForm openings={data.openings} markets={data.markets} />
        </div>
      </section>
    </main>
  );
}
