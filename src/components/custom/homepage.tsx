// @polsia:user-owned — client island for typed, claim-safe homepage content.
'use client';

import type { LucideIcon } from 'lucide-react';
import {
  ArrowRight,
  BadgeCheck,
  Building2,
  Check,
  Home,
  Leaf,
  LoaderCircle,
  Map as MapIcon,
  Scale,
  ShieldCheck,
  Sparkles,
  Sprout,
  Users,
} from 'lucide-react';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { apiFetch } from '@/lib/api-client';
import { bookingHrefForPlan } from '@/lib/business/booking-navigation';
import type { SiteContentResponse as SiteContentValues } from '@/lib/contracts/site-content';
import { SiteContentResponse } from '@/lib/contracts/site-content';

const ICONS: Record<string, LucideIcon> = {
  badge: BadgeCheck,
  building: Building2,
  home: Home,
  leaf: Leaf,
  map: MapIcon,
  scale: Scale,
  shield: ShieldCheck,
  sparkles: Sparkles,
  sprout: Sprout,
  users: Users,
};

function iconFor(name: string): LucideIcon {
  return ICONS[name] ?? Sparkles;
}

export function Homepage() {
  const [content, setContent] = useState<SiteContentValues | null>(null);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/site-content', { schema: SiteContentResponse })
      .then((result) => {
        if (active) setContent(result);
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
          <CardContent className="flex flex-col items-center gap-5 p-8 text-center sm:p-10">
            <p className="text-body text-destructive">
              We could not load the Mintbloom homepage. Please refresh and try again.
            </p>
            <Button asChild>
              <Link href="/book">Request a quote</Link>
            </Button>
          </CardContent>
        </Card>
      </main>
    );
  }

  if (!content) {
    return (
      <main className="container-page grid min-h-[60vh] place-items-center py-section-lg">
        <div className="flex items-center gap-3 text-body text-muted-foreground">
          <LoaderCircle className="size-5 animate-spin text-primary" aria-hidden />
          Loading Mintbloom…
        </div>
      </main>
    );
  }

  const scopeValues = content.values.filter((value) => value.eyebrow !== 'Continuity');

  return (
    <main id="top" className="relative">
      <section className="relative overflow-hidden">
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
        />
        <div
          aria-hidden
          className="pointer-events-none absolute inset-0 -z-10 opacity-35 [background-image:radial-gradient(circle_at_1px_1px,theme(colors.border)_1px,transparent_0)] [background-size:28px_28px]"
        />
        <div className="container-page grid gap-10 py-section-lg lg:grid-cols-[1.1fr_0.9fr] lg:items-center lg:gap-14">
          <div className="flex flex-col items-start gap-6">
            <Badge
              variant="outline"
              className="max-w-full gap-2 border-brand-200 px-3 py-1 text-left text-brand-700 dark:border-brand-700 dark:text-brand-300"
            >
              <Leaf className="size-3.5 shrink-0" aria-hidden />
              <span>{content.hero.eyebrow}</span>
            </Badge>
            <h1 className="max-w-3xl font-display text-display tracking-tight text-foreground">
              {content.hero.title} <span className="text-primary">{content.hero.accent}</span>
            </h1>
            <p className="max-w-2xl text-body-lg text-muted-foreground">
              {content.hero.description}
            </p>
            <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row sm:items-center">
              <Button asChild size="lg" className="w-full gap-2 shadow-brand sm:w-auto">
                <Link href="/book">
                  Request a customized quote <ArrowRight aria-hidden />
                </Link>
              </Button>
              <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                <Link href="#plans">Explore services</Link>
              </Button>
            </div>
          </div>
          <Card className="relative mx-auto w-full max-w-md overflow-hidden border-primary/15 bg-card/85 shadow-lg">
            <CardContent className="flex aspect-[5/4] flex-col justify-between p-6 sm:p-8">
              <div className="grid flex-1 place-items-center">
                <div className="relative grid size-40 place-items-center rounded-full bg-primary/10 text-primary sm:size-48">
                  <div
                    aria-hidden
                    className="absolute inset-4 rounded-full border border-primary/20"
                  />
                  <Sprout className="size-20" strokeWidth={1.2} aria-hidden />
                </div>
              </div>
              <div className="flex items-center gap-3 rounded-xl border border-border bg-background/80 px-4 py-3">
                <span className="grid size-9 shrink-0 place-items-center rounded-lg bg-primary/10 text-primary">
                  <Sparkles className="size-4" aria-hidden />
                </span>
                <span>
                  <span className="block text-small font-semibold text-foreground">
                    Human review before final pricing
                  </span>
                  <span className="block text-caption text-muted-foreground">
                    Share the scope and property details; final pricing is confirmed after review.
                  </span>
                </span>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>

      <section
        aria-label="Mintbloom credentials and approach"
        className="border-y border-border bg-muted/35"
      >
        <div className="container-page grid gap-x-6 gap-y-4 py-5 sm:grid-cols-2 lg:grid-cols-4">
          {content.trustPills.map((pill) => {
            const Icon = iconFor(pill.icon);
            return (
              <div key={pill.label} className="flex items-center gap-3 text-small">
                <Icon className="size-4 shrink-0 text-primary" aria-hidden />
                <span className="font-medium text-foreground">{pill.label}</span>
              </div>
            );
          })}
        </div>
      </section>

      <section id="plans" className="section-lg scroll-mt-20">
        <div className="container-page flex flex-col gap-8">
          <div className="flex max-w-3xl flex-col gap-3">
            <p className="text-eyebrow text-primary">Services</p>
            <h2 className="font-display text-h2 text-foreground">Choose the scope that fits.</h2>
            <p className="text-body-lg text-muted-foreground">
              Basic Cleaning starts at $185. Every service request is reviewed for a customized
              quote; final pricing is confirmed after scope review.
            </p>
          </div>
          <div className="grid items-stretch gap-5 lg:grid-cols-3">
            {content.plans.map((plan) => {
              const quoteOnly = plan.name === 'Specialty scope';
              return (
                <Card
                  key={plan.name}
                  className={
                    plan.emphasis
                      ? 'flex h-full flex-col border-primary/35 bg-primary/[0.035] shadow-md'
                      : 'flex h-full flex-col border-border'
                  }
                >
                  <CardHeader className="gap-4 p-6">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-eyebrow text-muted-foreground">{plan.audience}</p>
                      <Badge variant={quoteOnly ? 'outline' : 'secondary'}>
                        {quoteOnly ? 'Quote required' : 'Starting price'}
                      </Badge>
                    </div>
                    <CardTitle className="font-display text-h3">{plan.name}</CardTitle>
                    {plan.priceLabel && (
                      <p className="text-body font-semibold text-primary">{plan.priceLabel}</p>
                    )}
                    <p className="text-body text-muted-foreground">{plan.body}</p>
                  </CardHeader>
                  <CardContent className="flex flex-1 flex-col p-6 pt-0">
                    <ul className="flex flex-1 flex-col gap-3 border-t border-border pt-5">
                      {plan.features.map((feature) => (
                        <li
                          key={feature}
                          className="flex items-start gap-3 text-small text-foreground/90"
                        >
                          <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                          <span>{feature}</span>
                        </li>
                      ))}
                    </ul>
                    <Button
                      asChild
                      variant={plan.emphasis ? 'default' : 'outline'}
                      className="mt-6 w-full gap-2"
                    >
                      <Link href={bookingHrefForPlan(plan.name)}>
                        {plan.cta}
                        <ArrowRight className="size-4" aria-hidden />
                      </Link>
                    </Button>
                  </CardContent>
                </Card>
              );
            })}
          </div>
        </div>
      </section>

      <section id="how" className="scroll-mt-20 bg-primary text-primary-foreground">
        <div className="container-page grid gap-8 py-section-lg lg:grid-cols-[0.75fr_1.25fr] lg:items-start">
          <div className="flex flex-col items-start gap-4">
            <p className="text-eyebrow text-primary-foreground/75">How it works</p>
            <h2 className="font-display text-h2">A clear path from scope to clean.</h2>
            <Button asChild variant="secondary" className="mt-2 gap-2">
              <Link href="/book">
                Request a quote <ArrowRight className="size-4" aria-hidden />
              </Link>
            </Button>
          </div>
          <ol className="grid gap-4 sm:grid-cols-3">
            {content.steps.map((step) => (
              <li
                key={step.number}
                className="rounded-2xl border border-primary-foreground/20 bg-primary-foreground/10 p-5"
              >
                <p className="font-display text-h3 text-primary-foreground/65">{step.number}</p>
                <h3 className="mt-4 text-body font-semibold">{step.title}</h3>
                <p className="mt-2 text-small leading-relaxed text-primary-foreground/80">
                  {step.body}
                </p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <section id="scope" className="section-lg scroll-mt-20">
        <div className="container-page grid gap-8 lg:grid-cols-[0.7fr_1.3fr]">
          <div className="flex flex-col gap-3">
            <p className="text-eyebrow text-primary">Thoughtful by design</p>
            <h2 className="font-display text-h2">Care with clear boundaries.</h2>
            <p className="text-body text-muted-foreground">
              The visit, products, and price are discussed in context, with a quote when the scope
              needs a closer look.
            </p>
          </div>
          <div className="grid gap-4 sm:grid-cols-2">
            {scopeValues.map((value) => {
              const Icon = iconFor(value.icon);
              return (
                <Card key={value.eyebrow} className="h-full border-primary/10 bg-card/80">
                  <CardContent className="flex h-full flex-col gap-4 p-5 sm:p-6">
                    <span className="grid size-10 place-items-center rounded-xl bg-primary/10 text-primary">
                      <Icon className="size-5" aria-hidden />
                    </span>
                    <div>
                      <p className="text-eyebrow text-primary">{value.eyebrow}</p>
                      <h3 className="mt-2 font-display text-h4 text-foreground">{value.title}</h3>
                    </div>
                    <p className="text-small leading-relaxed text-muted-foreground">{value.body}</p>
                  </CardContent>
                </Card>
              );
            })}
            <Card className="border-primary/10 bg-muted/35 sm:col-span-2">
              <CardContent className="flex items-start gap-4 p-5 sm:p-6">
                <span className="grid size-10 shrink-0 place-items-center rounded-xl bg-primary/10 text-primary">
                  <Leaf className="size-5" aria-hidden />
                </span>
                <div>
                  <p className="text-eyebrow text-primary">{content.faith.eyebrow}</p>
                  <h3 className="mt-1 font-display text-h4 text-foreground">
                    {content.faith.title}
                  </h3>
                  <p className="mt-2 max-w-3xl text-small leading-relaxed text-muted-foreground">
                    {content.faith.intro}
                  </p>
                </div>
              </CardContent>
            </Card>
          </div>
        </div>
      </section>

      <section id="faq" className="section scroll-mt-20 bg-muted/35">
        <div className="container-page grid gap-8 lg:grid-cols-[0.65fr_1.35fr] lg:items-start">
          <div className="flex flex-col items-start gap-4">
            <p className="text-eyebrow text-primary">FAQ</p>
            <h2 className="font-display text-h2">Answers before you request.</h2>
            <p className="text-body text-muted-foreground">
              Read more about product choices, scheduling, scope, and pricing.
            </p>
            <Button asChild variant="outline">
              <Link href="/faq">Read all FAQs</Link>
            </Button>
          </div>
          <Card className="p-2">
            <Accordion type="single" collapsible className="w-full">
              {content.faqs.slice(0, 3).map((faq) => (
                <AccordionItem
                  key={faq.question}
                  value={faq.question}
                  className="border-border px-2 last:border-b-0 sm:px-3"
                >
                  <AccordionTrigger className="text-left text-body font-medium hover:no-underline">
                    {faq.question}
                  </AccordionTrigger>
                  <AccordionContent className="text-body text-muted-foreground">
                    {faq.answer}
                  </AccordionContent>
                </AccordionItem>
              ))}
            </Accordion>
          </Card>
        </div>
      </section>

      <section className="section-lg">
        <div className="container-page">
          <Card className="relative overflow-hidden border-primary/20 bg-gradient-to-br from-brand-50 via-background to-brand-100 dark:from-brand-900/30 dark:via-background dark:to-brand-900/20">
            <CardContent className="relative flex flex-col items-start gap-5 p-6 sm:p-10">
              <p className="text-eyebrow text-primary">{content.closing.eyebrow}</p>
              <h2 className="max-w-2xl font-display text-h2 text-foreground">
                {content.closing.title}
              </h2>
              <p className="max-w-2xl text-body-lg text-muted-foreground">{content.closing.body}</p>
              <div className="flex w-full flex-col gap-3 sm:w-auto sm:flex-row">
                <Button asChild size="lg" className="w-full gap-2 shadow-brand sm:w-auto">
                  <Link href="/book">
                    Request a customized quote <ArrowRight className="size-4" aria-hidden />
                  </Link>
                </Button>
                <Button asChild variant="outline" size="lg" className="w-full sm:w-auto">
                  <Link href="mailto:mintbloom-pro@polsia.app">Email Mintbloom</Link>
                </Button>
              </div>
            </CardContent>
          </Card>
        </div>
      </section>
    </main>
  );
}
