// @polsia:user-owned — v3 live estimate calculator for /book (request only, no payment).
'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { formatUsdFromCents } from '@/lib/business/pricing/money';
import {
  EstimateResponse,
  type EstimateResponse as EstimateResponseType,
} from '@/lib/contracts/pricing';
import { intakeForms } from '@/lib/service-intake-config/forms';

type ServiceId =
  | 'standard'
  | 'deep'
  | 'move'
  | 'airbnb'
  | 'commercial'
  | 'postConstruction';

const SERVICES: { id: ServiceId; label: string }[] = [
  { id: 'standard', label: 'Standard / Basic / Regular' },
  { id: 'deep', label: 'Deep cleaning' },
  { id: 'move', label: 'Move-in / Move-out' },
  { id: 'airbnb', label: 'Airbnb turnover' },
  { id: 'commercial', label: 'Commercial' },
  { id: 'postConstruction', label: 'Post-construction / builders' },
];

type FormState = {
  service: ServiceId;
  street: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  squareFeet: string;
  bedrooms: string;
  fullBaths: string;
  halfBaths: string;
  offices: string;
  extraLivingRooms: string;
  kitchens: string;
  cadence: 'one_time' | 'weekly' | 'biweekly' | 'monthly';
  oven: string;
  fridge: string;
  baseboards: boolean;
  linenChanges: string;
  laundry: string;
  dishes: string;
  garage: string;
  interiorWindows: string;
  petHairNeeded: boolean;
  rushRequested: boolean;
  highWorkRequested: boolean;
  severeOrUnknownCondition: boolean;
  preferredDate: string;
  notes: string;
  fullName: string;
  email: string;
  phone: string;
};

const initial: FormState = {
  service: 'standard',
  street: '',
  unit: '',
  city: 'Lubbock',
  state: 'TX',
  zip: '',
  squareFeet: '',
  bedrooms: '0',
  fullBaths: '1',
  halfBaths: '0',
  offices: '0',
  extraLivingRooms: '0',
  kitchens: '1',
  cadence: 'one_time',
  oven: '0',
  fridge: '0',
  baseboards: false,
  linenChanges: '0',
  laundry: '0',
  dishes: '0',
  garage: '0',
  interiorWindows: '0',
  petHairNeeded: false,
  rushRequested: false,
  highWorkRequested: false,
  severeOrUnknownCondition: false,
  preferredDate: '',
  notes: '',
  fullName: '',
  email: '',
  phone: '',
};

function n(value: string): number {
  const parsed = Number.parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : 0;
}

export function PricingCalculator() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [estimate, setEstimate] = useState<EstimateResponseType | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  }, []);

  const bedroomsValue = form.bedrooms === '5plus' ? '5plus' : n(form.bedrooms);

  const estimateBody = useMemo(
    () => ({
      service: form.service,
      city: form.city,
      state: form.state,
      zip: form.zip || '00000',
      squareFeet: form.squareFeet.trim() === '' ? null : n(form.squareFeet),
      bedrooms: bedroomsValue,
      fullBaths: n(form.fullBaths),
      halfBaths: n(form.halfBaths),
      offices: n(form.offices),
      extraLivingRooms: n(form.extraLivingRooms),
      kitchens: n(form.kitchens),
      cadence: form.cadence,
      // Public estimates assume first visit (full price). Recurring discounts apply from visit 2.
      isFirstRecurringVisit: true,
      addOnQuantities: {
        oven: n(form.oven),
        fridge: n(form.fridge),
        baseboards: form.baseboards ? 1 : 0,
        linenChanges: n(form.linenChanges),
        laundry: n(form.laundry),
        dishes: n(form.dishes),
        garage: n(form.garage),
        interiorWindows: n(form.interiorWindows),
      },
      heavyConditionApproved: false,
      petHairNeeded: form.petHairNeeded,
      rushRequested: form.rushRequested,
      travelMiles: null,
      highWorkRequested: form.highWorkRequested,
      severeOrUnknownCondition: form.severeOrUnknownCondition,
    }),
    [form, bedroomsValue],
  );

  useEffect(() => {
    if (step < 1) return;
    let active = true;
    const timer = setTimeout(() => {
      setEstimating(true);
      apiFetch('/api/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify(estimateBody),
        schema: EstimateResponse,
      })
        .then((result) => {
          if (active) setEstimate(result);
        })
        .catch(() => {
          if (active) setEstimate(null);
        })
        .finally(() => {
          if (active) setEstimating(false);
        });
    }, 350);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [estimateBody, step]);

  async function submitRequest() {
    setSubmitting(true);
    try {
      const formDef = intakeForms.find((f) => f.id === 'cleaning-quote');
      if (!formDef) throw new Error('Form missing');

      const snapshot = JSON.stringify({
        status: estimate?.status,
        totalCents: estimate?.totalCents,
        subtotalCents: estimate?.subtotalCents,
        taxCents: estimate?.taxCents,
        rateCardVersion: estimate?.rateCardVersion,
        lines: estimate?.lines,
        reasons: estimate?.reasons,
      }).slice(0, 3900);

      const serviceLabel = SERVICES.find((s) => s.id === form.service)?.label ?? form.service;
      const answers = {
        service_type:
          form.service === 'standard'
            ? 'basicResidential'
            : form.service === 'deep'
              ? 'deepCleaning'
              : form.service === 'move'
                ? 'moveInMoveOut'
                : form.service === 'airbnb'
                  ? 'oneTimeResidential'
                  : form.service === 'commercial'
                    ? 'officeCommercial'
                    : 'postConstruction',
        property_type:
          form.service === 'commercial'
            ? 'commercial'
            : form.service === 'postConstruction'
              ? 'builder'
              : 'residential',
        bedrooms: form.bedrooms === '5plus' ? 5 : n(form.bedrooms),
        bathrooms: n(form.fullBaths) + n(form.halfBaths),
        cadence: form.cadence,
        street: form.street,
        unit: form.unit,
        city: form.city,
        state: form.state,
        zip: form.zip,
        preferred_date: form.preferredDate || undefined,
        scope_notes: [
          `Service: ${serviceLabel}`,
          `Sq ft: ${form.squareFeet || 'unknown'}`,
          `Beds: ${form.bedrooms}; full baths: ${form.fullBaths}; half baths: ${form.halfBaths}`,
          `Offices: ${form.offices}; extra living: ${form.extraLivingRooms}; kitchens: ${form.kitchens}`,
          form.notes,
          estimate?.status === 'priced'
            ? `Estimate total: ${formatUsdFromCents(estimate.totalCents)} (v${estimate.rateCardVersion})`
            : `Quote required: ${(estimate?.reasons ?? []).join('; ')}`,
        ]
          .filter(Boolean)
          .join('\n')
          .slice(0, 4000),
        estimate_snapshot: snapshot,
        full_name: form.fullName,
        email: form.email,
        phone: form.phone,
      };

      const result = await apiFetch<{ reference?: string; id?: string }>('/api/service-intake', {
        method: 'POST',
        body: JSON.stringify({
          formId: formDef.id,
          formVersion: formDef.version,
          attemptId: crypto.randomUUID(),
          answers,
        }),
      });
      setReference(result.reference ?? result.id ?? 'received');
      toast.success('Request submitted');
    } catch {
      toast.error('Could not submit your request. Please try again.');
    } finally {
      setSubmitting(false);
    }
  }

  if (reference) {
    return (
      <div className="mx-auto max-w-xl space-y-4 rounded-2xl border border-border bg-card p-6">
        <h2 className="text-2xl font-semibold">Request received</h2>
        <p className="text-sm text-muted-foreground">
          Reference: <span className="font-medium text-foreground">{reference}</span>. We will review
          your details and contact you. This is not a confirmed booking.
        </p>
        <Button type="button" onClick={() => window.location.assign('/book')}>
          Start another estimate
        </Button>
      </div>
    );
  }

  const steps = ['Address & service', 'Property size', 'Details & add-ons', 'Contact & submit'];
  const isQuote =
    estimate?.status === 'quote_required' ||
    form.service === 'commercial' ||
    form.service === 'postConstruction' ||
    form.bedrooms === '5plus';

  return (
    <div className="mx-auto grid max-w-5xl gap-8 lg:grid-cols-[minmax(0,1fr)_20rem]">
      <div className="space-y-6">
        <div>
          <p className="text-sm text-muted-foreground">
            Step {step + 1} of {steps.length}: {steps[step]}
          </p>
          <h1 className="mt-1 text-3xl font-semibold tracking-tight">Get your cleaning estimate</h1>
        </div>

        {step === 0 && (
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-2">
              <Label htmlFor="service">Service</Label>
              <select
                id="service"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.service}
                onChange={(e) => set('service', e.target.value as ServiceId)}
              >
                {SERVICES.map((s) => (
                  <option key={s.id} value={s.id}>
                    {s.label}
                  </option>
                ))}
              </select>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="street">Street address</Label>
              <Input id="street" value={form.street} onChange={(e) => set('street', e.target.value)} required />
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit</Label>
                <Input id="unit" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">ZIP</Label>
                <Input id="zip" value={form.zip} onChange={(e) => set('zip', e.target.value)} required />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="city">City</Label>
                <Input id="city" value={form.city} onChange={(e) => set('city', e.target.value)} required />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">State</Label>
                <Input id="state" value={form.state} onChange={(e) => set('state', e.target.value)} required />
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-2">
              <Label htmlFor="sqft">Interior square footage</Label>
              <Input
                id="sqft"
                type="number"
                min={1}
                value={form.squareFeet}
                onChange={(e) => set('squareFeet', e.target.value)}
                placeholder="e.g. 1200"
              />
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="beds">Bedrooms</Label>
                <select
                  id="beds"
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)}
                >
                  {['0', '1', '2', '3', '4', '5plus'].map((v) => (
                    <option key={v} value={v}>
                      {v === '5plus' ? '5+' : v === '0' ? 'Studio (0)' : v}
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fullBaths">Full baths</Label>
                <Input
                  id="fullBaths"
                  type="number"
                  min={0}
                  value={form.fullBaths}
                  onChange={(e) => set('fullBaths', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="halfBaths">Half baths</Label>
                <Input
                  id="halfBaths"
                  type="number"
                  min={0}
                  value={form.halfBaths}
                  onChange={(e) => set('halfBaths', e.target.value)}
                />
              </div>
            </div>
            <div className="grid gap-2 sm:grid-cols-3">
              <div className="grid gap-2">
                <Label htmlFor="offices">Offices / studies</Label>
                <Input
                  id="offices"
                  type="number"
                  min={0}
                  value={form.offices}
                  onChange={(e) => set('offices', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="living">Extra living rooms</Label>
                <Input
                  id="living"
                  type="number"
                  min={0}
                  value={form.extraLivingRooms}
                  onChange={(e) => set('extraLivingRooms', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="kitchens">Kitchens</Label>
                <Input
                  id="kitchens"
                  type="number"
                  min={1}
                  value={form.kitchens}
                  onChange={(e) => set('kitchens', e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-2">
              <Label htmlFor="cadence">Frequency</Label>
              <select
                id="cadence"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.cadence}
                onChange={(e) => set('cadence', e.target.value as FormState['cadence'])}
              >
                <option value="one_time">One time</option>
                <option value="weekly">Weekly (Standard discount from 2nd visit)</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
            </div>
            <div className="grid gap-2 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="oven">Oven interiors</Label>
                <Input id="oven" type="number" min={0} value={form.oven} onChange={(e) => set('oven', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fridge">Fridge interiors</Label>
                <Input
                  id="fridge"
                  type="number"
                  min={0}
                  value={form.fridge}
                  onChange={(e) => set('fridge', e.target.value)}
                />
              </div>
            </div>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.baseboards}
                onChange={(e) => set('baseboards', e.target.checked)}
              />
              Hand-wiped baseboards (included in Deep/Move)
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.petHairNeeded}
                onChange={(e) => set('petHairNeeded', e.target.checked)}
              />
              Extra pet-hair work needed
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.highWorkRequested}
                onChange={(e) => set('highWorkRequested', e.target.checked)}
              />
              High fans / elevated surfaces requested
            </label>
            <label className="flex items-center gap-2 text-sm">
              <input
                type="checkbox"
                checked={form.severeOrUnknownCondition}
                onChange={(e) => set('severeOrUnknownCondition', e.target.checked)}
              />
              Severe or unknown condition
            </label>
            <div className="grid gap-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" value={form.notes} onChange={(e) => set('notes', e.target.value)} rows={3} />
            </div>
          </section>
        )}

        {step === 3 && (
          <section className="grid gap-4 rounded-2xl border border-border bg-card p-5">
            <div className="grid gap-2">
              <Label htmlFor="name">Full name</Label>
              <Input id="name" value={form.fullName} onChange={(e) => set('fullName', e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                value={form.email}
                onChange={(e) => set('email', e.target.value)}
                required
              />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" type="tel" value={form.phone} onChange={(e) => set('phone', e.target.value)} required />
            </div>
            <div className="grid gap-2">
              <Label htmlFor="date">Preferred date</Label>
              <Input
                id="date"
                type="date"
                value={form.preferredDate}
                onChange={(e) => set('preferredDate', e.target.value)}
              />
            </div>
            <p className="text-xs text-muted-foreground">
              Your estimate is based on the property details and services selected. We confirm size,
              condition, access and availability before confirming your booking. Any change in scope
              or price requires your approval before work begins.
            </p>
          </section>
        )}

        <div className="flex flex-wrap gap-3">
          {step > 0 ? (
            <Button type="button" variant="outline" onClick={() => setStep((s) => s - 1)}>
              Back
            </Button>
          ) : null}
          {step < steps.length - 1 ? (
            <Button
              type="button"
              onClick={() => setStep((s) => s + 1)}
              disabled={step === 0 && (!form.street || !form.city || !form.state || !form.zip)}
            >
              Continue
            </Button>
          ) : (
            <Button type="button" onClick={submitRequest} disabled={submitting || !form.fullName || !form.email}>
              {submitting
                ? 'Submitting…'
                : isQuote
                  ? form.service === 'commercial'
                    ? 'Request a Walkthrough'
                    : 'Request a Quote'
                  : 'Submit estimate request'}
            </Button>
          )}
        </div>
      </div>

      <aside className="h-fit space-y-4 rounded-2xl border border-primary/15 bg-primary/5 p-5 lg:sticky lg:top-24">
        <p className="text-sm font-medium text-primary">Your estimate</p>
        {estimating && <p className="text-sm text-muted-foreground">Calculating…</p>}
        {!estimating && !estimate && step > 0 && (
          <p className="text-sm text-muted-foreground">Enter property details to see pricing.</p>
        )}
        {estimate?.status === 'priced' && (
          <>
            <p className="text-3xl font-semibold">{formatUsdFromCents(estimate.totalCents)}</p>
            <p className="text-xs text-muted-foreground">
              Includes estimated tax
              {estimate.taxRateBps != null ? ` (${(estimate.taxRateBps / 100).toFixed(2)}%)` : ''}.
              Pre-tax {formatUsdFromCents(estimate.subtotalCents)}.
            </p>
            <details className="text-sm">
              <summary className="cursor-pointer font-medium">Itemized breakdown</summary>
              <ul className="mt-2 space-y-1 text-muted-foreground">
                {estimate.lines.map((line) => (
                  <li key={line.id} className="flex justify-between gap-2">
                    <span>{line.label}</span>
                    <span>{formatUsdFromCents(line.amountCents)}</span>
                  </li>
                ))}
              </ul>
            </details>
          </>
        )}
        {estimate?.status === 'quote_required' && (
          <>
            <p className="text-lg font-semibold">Quote / walkthrough required</p>
            <ul className="list-disc space-y-1 pl-4 text-sm text-muted-foreground">
              {estimate.reasons.map((reason) => (
                <li key={reason}>{reason}</li>
              ))}
            </ul>
            {estimate.commercialReferenceCents != null && form.service === 'commercial' ? (
              <p className="text-xs text-muted-foreground">
                Internal starting reference only:{' '}
                {formatUsdFromCents(estimate.commercialReferenceCents)} before tax (not a quote).
              </p>
            ) : null}
          </>
        )}
        {step === 0 && (
          <p className="text-sm text-muted-foreground">
            Standard starts at $145 · Deep $325 · Move $395 · Airbnb $210 before tax (first 600 sq.
            ft.).
          </p>
        )}
      </aside>
    </div>
  );
}
