// @polsia:user-owned — FAQ display. Restyle this freely, or swap the accordion
// for a card grid / whatever the brief calls for. It receives the SAME items the
// page emits as FAQPage JSON-LD, so changing the LOOK here never affects the
// structured data.
'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/components/ui/accordion';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { FaqResponse } from '@/lib/contracts/faq';
import type { FaqCta } from '@/lib/faq/content';

export function FaqAccordion({ cta }: { cta: FaqCta | null }) {
  const [items, setItems] = useState<ReturnType<typeof FaqResponse.parse>['items']>([]);
  const [loaded, setLoaded] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/faq', { schema: FaqResponse })
      .then((result) => {
        if (active) setItems(result.items);
      })
      .catch(() => {
        if (active) setError(true);
      })
      .finally(() => {
        if (active) setLoaded(true);
      });
    return () => {
      active = false;
    };
  }, []);

  if (!loaded) {
    return (
      <div className="grid gap-3 rounded-2xl border border-border/80 bg-card/80 p-6 shadow-md">
        <Skeleton className="h-6 w-4/5" />
        <Skeleton className="h-6 w-3/5" />
        <Skeleton className="h-6 w-2/3" />
      </div>
    );
  }

  if (error) {
    return (
      <Alert variant="destructive">
        <AlertTitle>Answers unavailable</AlertTitle>
        <AlertDescription>Please refresh the page to load the latest FAQ.</AlertDescription>
      </Alert>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="rounded-2xl border border-border/80 bg-card/85 p-2 shadow-lg backdrop-blur">
        <Accordion type="single" collapsible className="w-full">
          {items.map((item) => (
            <AccordionItem key={item.id} value={item.id} className="px-5 last:border-b-0">
              <AccordionTrigger className="text-left text-body font-semibold hover:no-underline hover:text-primary">
                {item.question}
              </AccordionTrigger>
              <AccordionContent className="max-w-3xl text-body text-muted-foreground">
                {item.answer}
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </div>
      {cta ? (
        <div className="flex flex-col items-start justify-between gap-3 rounded-2xl border border-primary/15 bg-primary/[0.035] p-5 sm:flex-row sm:items-center">
          <p className="text-small text-muted-foreground">
            Ready to choose your service? Residential and quote-required options start in the same
            booking flow.
          </p>
          <Button asChild className="w-full shrink-0 sm:w-auto">
            <Link href={cta.href}>{cta.label}</Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
