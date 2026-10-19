// @polsia:user-owned — shared direct-contact actions for public customer surfaces.

'use client';

import { MessageSquareText, Phone } from 'lucide-react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';

const PHONE_DISPLAY = '806-581-1100';
const PHONE_TARGET = '8065811100';

type ContactActionsProps = {
  variant?: 'inline' | 'floating';
  className?: string;
};

function ContactLinks({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={cn('flex flex-col gap-2 sm:flex-row sm:flex-wrap', compact && 'flex-row gap-2')}
    >
      <Button asChild className={cn('w-full gap-2 sm:w-auto', compact && 'w-auto px-3')}>
        <Link href={`tel:${PHONE_TARGET}`} aria-label={`Call Mintbloom Pro at ${PHONE_DISPLAY}`}>
          <Phone aria-hidden />
          <span>{compact ? 'Call' : `Call ${PHONE_DISPLAY}`}</span>
        </Link>
      </Button>
      <Button
        asChild
        variant="outline"
        className={cn('w-full gap-2 sm:w-auto', compact && 'w-auto px-3')}
      >
        <Link href={`sms:${PHONE_TARGET}`} aria-label={`Text Mintbloom Pro at ${PHONE_DISPLAY}`}>
          <MessageSquareText aria-hidden />
          <span>{compact ? 'Text' : `Text ${PHONE_DISPLAY}`}</span>
        </Link>
      </Button>
    </div>
  );
}

export function ContactActions({ variant = 'inline', className }: ContactActionsProps) {
  if (variant === 'floating') {
    return (
      <fieldset className={cn('contact-actions-floating', className)}>
        <legend className="sr-only">Quick contact</legend>
        <div className="contact-actions-floating__inner">
          <ContactLinks compact />
        </div>
      </fieldset>
    );
  }

  return (
    <div
      className={cn(
        'flex flex-col gap-3 rounded-xl border border-primary/15 bg-background/80 p-4',
        className,
      )}
    >
      <div>
        <p className="text-small font-semibold text-foreground">Prefer to reach us directly?</p>
        <p className="mt-1 text-body font-semibold tracking-wide text-primary">{PHONE_DISPLAY}</p>
      </div>
      <ContactLinks />
    </div>
  );
}
