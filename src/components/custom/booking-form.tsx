// @polsia:user-owned — Mintbloom's public quote-request entry point.
'use client';

import { Check, CircleAlert, LoaderCircle, RefreshCw, X } from 'lucide-react';
import { useSearchParams } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { ContactActions } from '@/components/custom/contact-actions';
import { IntakeForm } from '@/components/custom/service-intake/intake-form';
import { apiFetch } from '@/lib/api-client';
import type { BookingOptionsResponse as BookingOptionsResponseValues } from '@/lib/contracts/bookings';
import { BookingOptionsResponse } from '@/lib/contracts/bookings';
import { intakeForms } from '@/lib/service-intake-config/forms';
import type { Answers } from '@/modules/service-intake/contracts';

const SERVICE_VALUES = new Set([
  'basicResidential',
  'oneTimeResidential',
  'recurringResidential',
  'deepCleaning',
  'moveInMoveOut',
  'officeCommercial',
  'postConstruction',
  'medicalGradeSanitation',
]);

export function BookingForm() {
  const searchParams = useSearchParams();
  const requestedService = searchParams.get('service');
  const [options, setOptions] = useState<BookingOptionsResponseValues | null>(null);
  const [optionsError, setOptionsError] = useState(false);
  const [loadAttempt, setLoadAttempt] = useState(0);
  const [selectedServiceId, setSelectedServiceId] = useState(requestedService ?? '');
  const initialAnswers: Partial<Answers> = SERVICE_VALUES.has(requestedService ?? '')
    ? { service_type: requestedService ?? '' }
    : {};
  const onFieldValueChange = useCallback((fieldId: string, value: Answers[string] | undefined) => {
    if (fieldId === 'service_type') {
      setSelectedServiceId(typeof value === 'string' ? value : '');
    }
  }, []);

  useEffect(() => {
    let active = true;
    setOptionsError(false);
    apiFetch(`/api/bookings/options?retry=${loadAttempt}`, { schema: BookingOptionsResponse })
      .then((result) => {
        if (active) setOptions(result);
      })
      .catch(() => {
        if (active) setOptionsError(true);
      });
    return () => {
      active = false;
    };
  }, [loadAttempt]);

  const selectedService = options?.services.find((service) => service.id === selectedServiceId);

  return (
    <div className="mx-auto grid max-w-4xl gap-8 lg:grid-cols-[minmax(0,1fr)_18rem]">
      <div className="space-y-6">
        <ServiceScopePanel
          service={selectedService}
          loading={!options && !optionsError}
          error={optionsError}
          onRetry={() => setLoadAttempt((value) => value + 1)}
        />
        <IntakeForm
          forms={intakeForms}
          initialFormId="cleaning-quote"
          initialAnswers={initialAnswers}
          confirmationActions={<ContactActions />}
          onFieldValueChange={onFieldValueChange}
        />
      </div>
      <aside className="h-fit rounded-2xl border border-primary/15 bg-primary/5 p-5 lg:sticky lg:top-24">
        <p className="text-eyebrow text-primary">Pricing note</p>
        <p className="mt-2 text-small leading-relaxed text-muted-foreground">
          Basic Cleaning starts at $185. Other published amounts are starting prices only; final
          pricing is confirmed after we review your service and property details.
        </p>
      </aside>
    </div>
  );
}

function ServiceScopePanel({
  service,
  loading,
  error,
  onRetry,
}: {
  service: BookingOptionsResponseValues['services'][number] | undefined;
  loading: boolean;
  error: boolean;
  onRetry: () => void;
}) {
  if (loading)
    return (
      <section
        aria-labelledby="service-scope-heading"
        aria-live="polite"
        className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:p-6"
      >
        <p className="text-eyebrow text-primary">Service scope</p>
        <h2 id="service-scope-heading" className="mt-2 text-xl font-semibold tracking-tight">
          Loading the published scope…
        </h2>
        <div className="mt-4 flex items-center gap-2 text-sm text-muted-foreground">
          <LoaderCircle className="size-4 animate-spin" aria-hidden />
          We are loading the current inclusions, exclusions, and pricing status.
        </div>
      </section>
    );

  if (error)
    return (
      <section
        aria-labelledby="service-scope-heading"
        role="alert"
        className="rounded-2xl border border-destructive/30 bg-destructive/5 p-5 sm:p-6"
      >
        <p className="text-eyebrow text-destructive">Service scope unavailable</p>
        <h2 id="service-scope-heading" className="mt-2 text-xl font-semibold tracking-tight">
          We could not load the published scope.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          Please retry before submitting so you can review the selected service details.
        </p>
        <button
          type="button"
          onClick={onRetry}
          className="mt-4 inline-flex min-h-10 items-center gap-2 rounded-md border border-input bg-background px-4 py-2 text-sm font-medium transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <RefreshCw className="size-4" aria-hidden />
          Retry
        </button>
      </section>
    );

  if (!service)
    return (
      <section
        aria-labelledby="service-scope-heading"
        className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:p-6"
      >
        <p className="text-eyebrow text-primary">Service scope</p>
        <h2 id="service-scope-heading" className="mt-2 text-xl font-semibold tracking-tight">
          Choose a service to review its scope.
        </h2>
        <p className="mt-2 text-sm leading-relaxed text-muted-foreground">
          The published inclusions, exclusions, and pricing status will appear here before you send
          your request.
        </p>
      </section>
    );

  return (
    <section
      aria-labelledby="service-scope-heading"
      className="rounded-2xl border border-primary/15 bg-card p-5 shadow-sm sm:p-6"
    >
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between sm:gap-6">
        <div>
          <p className="text-eyebrow text-primary">Selected service scope</p>
          <h2 id="service-scope-heading" className="mt-2 text-xl font-semibold tracking-tight">
            {service.label}
          </h2>
          <p className="mt-2 max-w-prose text-sm leading-relaxed text-muted-foreground">
            {service.shortDescription}
          </p>
        </div>
        <p className="shrink-0 rounded-full bg-primary/10 px-3 py-1.5 text-sm font-semibold text-primary">
          {service.startingPrice}
        </p>
      </div>
      <div className="mt-6 grid gap-5 border-t border-border pt-5 sm:grid-cols-2">
        <div>
          <h3 className="text-sm font-semibold text-foreground">Included</h3>
          <ul className="mt-3 space-y-2.5" aria-label={`${service.label} inclusions`}>
            {service.inclusions.map((inclusion) => (
              <li key={inclusion} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <Check className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
                <span>{inclusion}</span>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <h3 className="text-sm font-semibold text-foreground">Not included</h3>
          <ul className="mt-3 space-y-2.5" aria-label={`${service.label} exclusions`}>
            {service.exclusions.map((exclusion) => (
              <li key={exclusion} className="flex items-start gap-2.5 text-sm leading-relaxed">
                <X className="mt-0.5 size-4 shrink-0 text-muted-foreground" aria-hidden />
                <span>{exclusion}</span>
              </li>
            ))}
          </ul>
        </div>
      </div>
      <p className="mt-5 flex items-start gap-2 border-t border-border pt-4 text-xs leading-relaxed text-muted-foreground">
        <CircleAlert className="mt-0.5 size-3.5 shrink-0" aria-hidden />
        Final pricing is confirmed after human review of the service and property details.
      </p>
    </section>
  );
}
