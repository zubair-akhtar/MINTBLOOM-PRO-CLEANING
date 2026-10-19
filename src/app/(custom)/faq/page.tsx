// @polsia:user-owned — the FAQ page. Restyle it freely: change the layout, the
// classes, the copy, swap <FaqAccordion/> for cards, add sections, etc. Keep two
// things for SEO: (1) stay a Server Component (no 'use client') so `metadata`
// renders, and (2) keep <FaqJsonLd items={faqContent.items} /> on the page so the
// FAQPage structured data ships. Edit the questions/answers + CTA in
// src/lib/faq/content.ts.

import { ArrowRight } from 'lucide-react';
import type { Metadata } from 'next';
import Link from 'next/link';
import { FaqAccordion } from '@/components/custom/faq-accordion';
import { Button } from '@/components/ui/button';
import { faqContent } from '@/lib/faq/content';
import { siteDescription, siteName } from '@/lib/site';
import { FaqJsonLd } from '@/modules/faq-page/faq-jsonld';

// Design rationale: Mintbloom's FAQ should feel calm, botanical, and precise. The
// page uses editorial display type, generous breathing room, and a single contained
// accordion so answers feel easy to scan without turning claim-sensitive copy into a sales wall.

export const metadata: Metadata = {
  title: 'FAQ',
  description: `Frequently asked questions about ${siteName}. ${siteDescription}`,
  alternates: { canonical: '/faq' },
};

export default function FaqPage() {
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      {/* SEO structured data — keep this when restyling (see FaqJsonLd). */}
      <FaqJsonLd items={faqContent.items} />
      <div className="container-page grid gap-10 py-section-lg lg:grid-cols-[0.7fr_1.3fr] lg:items-start lg:gap-16">
        <header className="flex flex-col gap-4 lg:sticky lg:top-24">
          <p className="text-eyebrow">Mintbloom answers</p>
          <h1 className="font-display text-display tracking-tight">
            Good questions deserve clear answers.
          </h1>
          {faqContent.intro ? (
            <p className="max-w-lg text-body-lg text-muted-foreground">{faqContent.intro}</p>
          ) : null}
          <p className="max-w-lg text-small text-muted-foreground">
            Scope, pricing, and product choices are explained plainly so you can decide with the
            full picture in view.
          </p>
          <Button asChild size="lg" className="mt-2 w-fit gap-2">
            <Link href="/book">
              Request a quote <ArrowRight className="size-4" aria-hidden />
            </Link>
          </Button>
        </header>
        <FaqAccordion cta={faqContent.cta} />
      </div>
    </main>
  );
}
