// @polsia:user-owned — v3 live estimate calculator for /book (request only, no payment).
'use client';

import {
  ArrowLeft,
  ArrowRight,
  Bath,
  BedDouble,
  Building2,
  CalendarDays,
  Check,
  ClipboardList,
  Home,
  LoaderCircle,
  Pin,
  Ruler,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useState } from 'react';
import { toast } from 'sonner';
import { AddressAutocomplete } from '@/components/custom/address-autocomplete';
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
import { cn } from '@/lib/utils';

type ServiceId =
  | 'standard'
  | 'deep'
  | 'move'
  | 'airbnb'
  | 'commercial'
  | 'postConstruction';

const SERVICES: { id: ServiceId; label: string; hint: string; icon: typeof Home }[] = [
  { id: 'standard', label: 'Standard / Basic', hint: 'From $145', icon: Home },
  { id: 'deep', label: 'Deep cleaning', hint: 'From $325', icon: Sparkles },
  { id: 'move', label: 'Move-in / Move-out', hint: 'From $395', icon: Building2 },
  { id: 'airbnb', label: 'Airbnb turnover', hint: 'From $210', icon: CalendarDays },
  { id: 'commercial', label: 'Commercial', hint: 'Walkthrough', icon: Building2 },
  { id: 'postConstruction', label: 'Post-construction', hint: 'Quote', icon: ClipboardList },
];

const STEPS = [
  { id: 'service', title: 'Property size', short: 'Property size', icon: Ruler },
  { id: 'details', title: 'Details & add-ons', short: 'Details & add-ons', icon: ClipboardList },
  { id: 'contact', title: 'Info & address', short: 'Info & address', icon: UserRound },
] as const;

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
  cabinets: string;
  baseboards: boolean;
  linenChanges: string;
  laundry: string;
  dishes: string;
  garage: string;
  interiorWindows: string;
  windowTracks: string;
  blinds: string;
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
  city: '',
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
  cabinets: '0',
  baseboards: false,
  linenChanges: '0',
  laundry: '0',
  dishes: '0',
  garage: '0',
  interiorWindows: '0',
  windowTracks: '0',
  blinds: '0',
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

function isEmail(value: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value.trim());
}

type FieldErrors = Partial<Record<keyof FormState | 'root', string>>;

export function PricingCalculator() {
  const [step, setStep] = useState(0);
  const [form, setForm] = useState<FormState>(initial);
  const [errors, setErrors] = useState<FieldErrors>({});
  const [estimate, setEstimate] = useState<EstimateResponseType | null>(null);
  const [estimating, setEstimating] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [reference, setReference] = useState<string | null>(null);

  const set = useCallback(<K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => {
      if (!prev[key]) return prev;
      const next = { ...prev };
      delete next[key];
      return next;
    });
  }, []);

  const bedroomsValue = form.bedrooms === '5plus' ? '5plus' : n(form.bedrooms);

  const estimateBody = useMemo(() => {
    const sqftRaw = form.squareFeet.trim();
    const sqftParsed = sqftRaw === '' ? null : n(form.squareFeet);
    // Provisional size so service / rooms / add-ons update live before sqft is entered.
    const squareFeet = sqftParsed && sqftParsed > 0 ? sqftParsed : 600;
    return {
      service: form.service,
      city: form.city || 'Lubbock',
      state: form.state || 'TX',
      zip: form.zip || '79401',
      squareFeet,
      bedrooms: bedroomsValue,
      fullBaths: Math.max(0, n(form.fullBaths)),
      halfBaths: Math.max(0, n(form.halfBaths)),
      offices: Math.max(0, n(form.offices)),
      extraLivingRooms: Math.max(0, n(form.extraLivingRooms)),
      kitchens: Math.max(1, n(form.kitchens)),
      cadence: form.cadence,
      // PDF: first visit is full price; recurring discount from second Standard visit.
      isFirstRecurringVisit: true,
      addOnQuantities: {
        oven: Math.max(0, n(form.oven)),
        fridge: Math.max(0, n(form.fridge)),
        cabinets: Math.max(0, n(form.cabinets)),
        baseboards: form.baseboards ? 1 : 0,
        linenChanges: Math.max(0, n(form.linenChanges)),
        laundry: Math.max(0, n(form.laundry)),
        dishes: Math.max(0, n(form.dishes)),
        garage: Math.max(0, n(form.garage)),
        interiorWindows: Math.max(0, n(form.interiorWindows)),
        windowTracks: Math.max(0, n(form.windowTracks)),
        blinds: Math.max(0, n(form.blinds)),
      },
      heavyConditionApproved: false,
      petHairNeeded: form.petHairNeeded,
      rushRequested: form.rushRequested,
      travelMiles: null,
      highWorkRequested: form.highWorkRequested,
      severeOrUnknownCondition: form.severeOrUnknownCondition,
      _provisionalSqft: !sqftParsed || sqftParsed <= 0,
    };
  }, [form, bedroomsValue]);

  const selectionDetails = useMemo(() => {
    const serviceLabel = SERVICES.find((s) => s.id === form.service)?.label ?? form.service;
    const sqftLabel = form.squareFeet.trim()
      ? `${n(form.squareFeet).toLocaleString()} sq. ft.`
      : '600 sq. ft. (placeholder)';
    const bedsLabel = form.bedrooms === '5plus' ? '5+' : form.bedrooms === '0' ? 'Studio' : form.bedrooms;
    const cadenceLabel =
      form.cadence === 'one_time'
        ? 'One time'
        : form.cadence === 'biweekly'
          ? 'Biweekly'
          : form.cadence.charAt(0).toUpperCase() + form.cadence.slice(1);

    const rows: { label: string; value: string }[] = [
      { label: 'Service', value: serviceLabel },
      { label: 'Size', value: sqftLabel },
      { label: 'Bedrooms', value: String(bedsLabel) },
      {
        label: 'Baths',
        value: `${n(form.fullBaths)} full · ${n(form.halfBaths)} half`,
      },
    ];
    if (n(form.offices) > 0) rows.push({ label: 'Offices', value: String(n(form.offices)) });
    if (n(form.extraLivingRooms) > 0) {
      rows.push({ label: 'Extra living', value: String(n(form.extraLivingRooms)) });
    }
    if (n(form.kitchens) > 1) rows.push({ label: 'Kitchens', value: String(n(form.kitchens)) });
    rows.push({ label: 'Frequency', value: cadenceLabel });

    const addOns: string[] = [];
    if (n(form.oven) > 0) addOns.push(`Oven ×${n(form.oven)}`);
    if (n(form.fridge) > 0) addOns.push(`Fridge ×${n(form.fridge)}`);
    if (n(form.cabinets) > 0) addOns.push(`Cabinets ×${n(form.cabinets)} doors`);
    if (form.baseboards) addOns.push('Baseboards');
    if (n(form.interiorWindows) > 0) addOns.push(`Windows ×${n(form.interiorWindows)}`);
    if (n(form.windowTracks) > 0) addOns.push(`Tracks ×${n(form.windowTracks)}`);
    if (n(form.blinds) > 0) addOns.push(`Blinds ×${n(form.blinds)}`);
    if (n(form.laundry) > 0) addOns.push(`Laundry ×${n(form.laundry)}`);
    if (n(form.linenChanges) > 0) addOns.push(`Linens ×${n(form.linenChanges)}`);
    if (n(form.dishes) > 0) addOns.push(`Dishes ×${n(form.dishes)}`);
    if (n(form.garage) > 0) addOns.push(`Garage ×${n(form.garage)}`);
    if (form.petHairNeeded) addOns.push('Pet hair');
    if (form.rushRequested) addOns.push('Rush');
    if (form.highWorkRequested) addOns.push('High surfaces');
    if (form.severeOrUnknownCondition) addOns.push('Severe condition');
    if (addOns.length) rows.push({ label: 'Add-ons', value: addOns.join(', ') });

    return rows;
  }, [form]);

  useEffect(() => {
    let active = true;
    const timer = setTimeout(() => {
      setEstimating(true);
      const { _provisionalSqft: _, ...payload } = estimateBody;
      apiFetch('/api/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify(payload),
        schema: EstimateResponse,
      })
        .then((result) => {
          if (active) setEstimate(result);
        })
        .catch(() => {
          // Keep the last good estimate visible if a request fails mid-edit.
        })
        .finally(() => {
          if (active) setEstimating(false);
        });
    }, 120);
    return () => {
      active = false;
      clearTimeout(timer);
    };
  }, [estimateBody]);

  function validateStep(index: number): boolean {
    const next: FieldErrors = {};
    if (index === 0) {
      if (!form.service) next.service = 'Choose a service.';
      if (!form.squareFeet.trim() || n(form.squareFeet) <= 0) {
        next.squareFeet = 'Enter square footage (required for estimate).';
      }
      if (form.fullBaths === '' || Number.isNaN(n(form.fullBaths))) {
        next.fullBaths = 'Enter full bathrooms (0 is OK).';
      }
      if (form.halfBaths === '' || Number.isNaN(n(form.halfBaths))) {
        next.halfBaths = 'Enter half bathrooms (0 is OK).';
      }
    }
    if (index === 2) {
      if (!form.fullName.trim()) next.fullName = 'Name is required.';
      if (!form.email.trim() || !isEmail(form.email)) next.email = 'Valid email is required.';
      if (!form.phone.trim() || form.phone.trim().length < 7) next.phone = 'Phone is required.';
      if (!form.street.trim()) next.street = 'Street address is required.';
      if (!form.city.trim()) next.city = 'City is required.';
      if (!form.state.trim()) next.state = 'State is required.';
      if (!form.zip.trim() || form.zip.trim().length < 5) next.zip = 'Valid ZIP is required.';
    }
    setErrors(next);
    return Object.keys(next).length === 0;
  }

  function goNext() {
    if (!validateStep(step)) {
      toast.error('Please complete the required fields before continuing.');
      return;
    }
    setStep((s) => Math.min(s + 1, STEPS.length - 1));
  }

  function goBack() {
    setErrors({});
    setStep((s) => Math.max(s - 1, 0));
  }

  async function submitRequest() {
    if (!validateStep(2)) {
      toast.error('Please complete the required fields.');
      return;
    }
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
          `Sq ft: ${form.squareFeet}`,
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

  const isQuote =
    estimate?.status === 'quote_required' ||
    form.service === 'commercial' ||
    form.service === 'postConstruction' ||
    form.bedrooms === '5plus';

  if (reference) {
    return (
      <div className="mx-auto max-w-lg space-y-4 rounded-3xl border border-primary/20 bg-gradient-to-b from-primary/10 to-card p-6 text-center shadow-sm sm:p-8">
        <div className="mx-auto flex size-14 items-center justify-center rounded-full bg-primary text-primary-foreground">
          <Check className="size-7" aria-hidden />
        </div>
        <h2 className="text-2xl font-semibold tracking-tight">Request received</h2>
        <p className="text-sm text-muted-foreground">
          Reference <span className="font-semibold text-foreground">{reference}</span>. We will review
          your details and contact you. This is not a confirmed booking.
        </p>
        <Button type="button" className="min-h-11 w-full sm:w-auto" onClick={() => window.location.assign('/book')}>
          Start another estimate
        </Button>
      </div>
    );
  }

  return (
    <div className="mx-auto grid max-w-6xl gap-6 lg:grid-cols-[minmax(0,1fr)_22rem] lg:gap-8">
      <div className="space-y-5">
        <header className="space-y-1">
          <p className="text-sm font-medium text-primary">Mintbloom estimate</p>
          <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">Get your cleaning price</h1>
          <p className="text-sm text-muted-foreground">
            Complete each step — required fields must be filled before you continue.
          </p>
        </header>

        {/* Chevron wizard: active = primary; inactive = light gray; white arrow line only */}
        <nav aria-label="Estimate steps" className="w-full overflow-hidden rounded-md">
          <ol className="flex w-full">
            {STEPS.map((item, index) => {
              const Icon = item.icon;
              const reached = index <= step;
              const isFirst = index === 0;
              const isLast = index === STEPS.length - 1;
              const arrow = 16;
              const clipPath = isLast
                ? `polygon(0 0, 100% 0, 100% 100%, 0 100%, ${arrow}px 50%)`
                : isFirst
                  ? `polygon(0 0, calc(100% - ${arrow}px) 0, 100% 50%, calc(100% - ${arrow}px) 100%, 0 100%)`
                  : `polygon(0 0, calc(100% - ${arrow}px) 0, 100% 50%, calc(100% - ${arrow}px) 100%, 0 100%, ${arrow}px 50%)`;

              return (
                <li
                  key={item.id}
                  className="relative min-w-0 flex-1"
                  style={{
                    marginLeft: isFirst ? 0 : `-${arrow - 2}px`,
                    zIndex: STEPS.length - index,
                  }}
                >
                  <button
                    type="button"
                    disabled={index > step}
                    aria-current={index === step ? 'step' : undefined}
                    onClick={() => {
                      if (index < step) {
                        setErrors({});
                        setStep(index);
                      }
                    }}
                    className={cn(
                      'flex h-[4.75rem] w-full flex-col items-center justify-center gap-1 px-4 text-center transition-colors sm:h-[5.25rem] sm:px-6',
                      reached
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-zinc-200 text-zinc-600',
                      index > step && 'cursor-not-allowed',
                    )}
                    style={{
                      clipPath,
                      // White chevron border line between steps (no gap)
                      filter: isLast ? undefined : 'drop-shadow(2px 0 0 #ffffff)',
                    }}
                  >
                    <span
                      className={cn(
                        'flex size-7 items-center justify-center rounded-full text-xs font-bold sm:size-8 sm:text-sm',
                        reached
                          ? 'bg-white text-primary shadow-sm'
                          : 'bg-white text-zinc-500',
                      )}
                    >
                      {index < step ? (
                        <Check className="size-3.5 sm:size-4" strokeWidth={2.5} />
                      ) : (
                        index + 1
                      )}
                    </span>
                    <span className="flex max-w-full items-center justify-center gap-1">
                      <Icon className="hidden size-3 shrink-0 sm:block" aria-hidden />
                      <span className="truncate text-[10px] font-semibold tracking-wide sm:text-xs">
                        {item.short}
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ol>
        </nav>

        {step === 0 && (
          <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Property size</h2>
              <p className="text-sm text-muted-foreground">Choose a service and enter the home size.</p>
            </div>

            <div className="grid gap-2 sm:grid-cols-2">
              {SERVICES.map((s) => {
                const Icon = s.icon;
                const selected = form.service === s.id;
                return (
                  <button
                    key={s.id}
                    type="button"
                    onClick={() => set('service', s.id)}
                    className={cn(
                      'flex min-h-16 items-start gap-3 rounded-xl border px-3 py-3 text-left transition-all',
                      selected
                        ? 'border-primary bg-primary/10 ring-2 ring-primary/30'
                        : 'border-border hover:border-primary/40 hover:bg-muted/40',
                    )}
                  >
                    <span
                      className={cn(
                        'mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg',
                        selected ? 'bg-primary text-primary-foreground' : 'bg-muted text-foreground',
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <span>
                      <span className="block text-sm font-semibold">{s.label}</span>
                      <span className="text-xs text-muted-foreground">{s.hint}</span>
                    </span>
                  </button>
                );
              })}
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="sqft">
                  Interior square footage <span className="text-destructive">*</span>
                </Label>
                <div className="relative">
                  <Ruler className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-primary" />
                  <Input
                    id="sqft"
                    type="number"
                    min={1}
                    inputMode="numeric"
                    className="h-11 pl-10"
                    value={form.squareFeet}
                    onChange={(e) => set('squareFeet', e.target.value)}
                    placeholder="e.g. 1200"
                    aria-invalid={errors.squareFeet ? true : undefined}
                  />
                </div>
                {errors.squareFeet ? <p className="text-xs text-destructive">{errors.squareFeet}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="beds">
                  <span className="inline-flex items-center gap-1.5">
                    <BedDouble className="size-3.5 text-primary" /> Bedrooms
                  </span>
                </Label>
                <select
                  id="beds"
                  className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                  value={form.bedrooms}
                  onChange={(e) => set('bedrooms', e.target.value)}
                >
                  {['0', '1', '2', '3', '4', '5plus'].map((v) => (
                    <option key={v} value={v}>
                      {v === '5plus' ? '5+ (quote)' : v === '0' ? 'Studio (0)' : v}
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid gap-2">
                <Label htmlFor="fullBaths">
                  <span className="inline-flex items-center gap-1.5">
                    <Bath className="size-3.5 text-primary" /> Full baths <span className="text-destructive">*</span>
                  </span>
                </Label>
                <Input
                  id="fullBaths"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.fullBaths}
                  onChange={(e) => set('fullBaths', e.target.value)}
                  aria-invalid={errors.fullBaths ? true : undefined}
                />
                {errors.fullBaths ? <p className="text-xs text-destructive">{errors.fullBaths}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="halfBaths">
                  Half baths <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="halfBaths"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.halfBaths}
                  onChange={(e) => set('halfBaths', e.target.value)}
                  aria-invalid={errors.halfBaths ? true : undefined}
                />
                {errors.halfBaths ? <p className="text-xs text-destructive">{errors.halfBaths}</p> : null}
              </div>

              <div className="grid gap-2">
                <Label htmlFor="offices">Offices / studies</Label>
                <Input
                  id="offices"
                  type="number"
                  min={0}
                  className="h-11"
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
                  className="h-11"
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
                  className="h-11"
                  value={form.kitchens}
                  onChange={(e) => set('kitchens', e.target.value)}
                />
              </div>
            </div>
          </section>
        )}

        {step === 1 && (
          <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Details &amp; add-ons</h2>
              <p className="text-sm text-muted-foreground">Optional extras and visit preferences.</p>
            </div>

            <div className="grid gap-2">
              <Label htmlFor="cadence">Frequency</Label>
              <select
                id="cadence"
                className="flex h-11 w-full rounded-md border border-input bg-background px-3 text-sm"
                value={form.cadence}
                onChange={(e) => set('cadence', e.target.value as FormState['cadence'])}
              >
                <option value="one_time">One time</option>
                <option value="weekly">Weekly</option>
                <option value="biweekly">Biweekly</option>
                <option value="monthly">Monthly</option>
              </select>
              <p className="text-xs text-muted-foreground">
                First Standard visit is full price. Weekly 10% / biweekly 7% / monthly 5% apply from the
                second completed recurring visit.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="oven">Oven interiors ($60 each)</Label>
                <Input id="oven" type="number" min={0} className="h-11" value={form.oven} onChange={(e) => set('oven', e.target.value)} />
                {form.service === 'move' ? (
                  <p className="text-xs text-muted-foreground">1 oven included with Move.</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="fridge">Fridge interiors ($45 each)</Label>
                <Input
                  id="fridge"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.fridge}
                  onChange={(e) => set('fridge', e.target.value)}
                />
                {form.service === 'move' ? (
                  <p className="text-xs text-muted-foreground">1 fridge included with Move.</p>
                ) : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="cabinets">Cabinet doors/drawers</Label>
                <Input
                  id="cabinets"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.cabinets}
                  onChange={(e) => set('cabinets', e.target.value)}
                />
                <p className="text-xs text-muted-foreground">
                  $60 up to 20; then $3 each. Included with Move.
                </p>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="windows">Interior window panes ($8, $40 min)</Label>
                <Input
                  id="windows"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.interiorWindows}
                  onChange={(e) => set('interiorWindows', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="tracks">Window tracks ($5 each)</Label>
                <Input
                  id="tracks"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.windowTracks}
                  onChange={(e) => set('windowTracks', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="blinds">Blinds hand-wipe ($8 each)</Label>
                <Input
                  id="blinds"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.blinds}
                  onChange={(e) => set('blinds', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="linens">
                  {form.service === 'airbnb' ? 'Bed changes (2 included)' : 'Linen / bed changes ($12)'}
                </Label>
                <Input
                  id="linens"
                  type="number"
                  min={0}
                  max={form.service === 'airbnb' ? 6 : undefined}
                  className="h-11"
                  value={form.linenChanges}
                  onChange={(e) => set('linenChanges', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="laundry">Laundry loads ($30, max 2)</Label>
                <Input
                  id="laundry"
                  type="number"
                  min={0}
                  max={2}
                  className="h-11"
                  value={form.laundry}
                  onChange={(e) => set('laundry', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="dishes">Dish blocks ($25 / 15 min, max 2)</Label>
                <Input
                  id="dishes"
                  type="number"
                  min={0}
                  max={2}
                  className="h-11"
                  value={form.dishes}
                  onChange={(e) => set('dishes', e.target.value)}
                />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="garage">Garage sweep ($40 / bay)</Label>
                <Input
                  id="garage"
                  type="number"
                  min={0}
                  className="h-11"
                  value={form.garage}
                  onChange={(e) => set('garage', e.target.value)}
                />
              </div>
            </div>

            <div className="grid gap-3 rounded-xl bg-muted/40 p-3">
              {form.service === 'deep' || form.service === 'move' ? (
                <p className="text-sm text-muted-foreground">
                  Hand-wiped baseboards: <span className="font-medium text-foreground">Included</span>
                </p>
              ) : (
                <label className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={form.baseboards}
                    onChange={(e) => set('baseboards', e.target.checked)}
                  />
                  Hand-wiped baseboards ($40 per started 1,000 sq. ft.)
                </label>
              )}
              {(
                [
                  ['petHairNeeded', 'Extra pet-hair work ($35)', form.petHairNeeded],
                  ['rushRequested', 'Rush request ($50, pending confirmation)', form.rushRequested],
                  ['highWorkRequested', 'High fans / elevated surfaces (quote review)', form.highWorkRequested],
                  ['severeOrUnknownCondition', 'Severe or unknown condition (quote review)', form.severeOrUnknownCondition],
                ] as const
              ).map(([key, label, checked]) => (
                <label key={key} className="flex items-center gap-3 text-sm">
                  <input
                    type="checkbox"
                    className="size-4 accent-[var(--primary)]"
                    checked={checked}
                    onChange={(e) => set(key, e.target.checked)}
                  />
                  {label}
                </label>
              ))}
            </div>

            <div className="grid gap-2">
              <Label htmlFor="notes">Notes (optional)</Label>
              <Textarea id="notes" rows={3} value={form.notes} onChange={(e) => set('notes', e.target.value)} />
            </div>
          </section>
        )}

        {step === 2 && (
          <section className="space-y-5 rounded-2xl border border-border bg-card p-4 shadow-sm sm:p-6">
            <div>
              <h2 className="text-lg font-semibold">Your info &amp; address</h2>
              <p className="text-sm text-muted-foreground">
                Where should we clean, and how do we reach you?
              </p>
            </div>

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="name">
                  Full name <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="name"
                  className="h-11"
                  value={form.fullName}
                  onChange={(e) => set('fullName', e.target.value)}
                  aria-invalid={errors.fullName ? true : undefined}
                />
                {errors.fullName ? <p className="text-xs text-destructive">{errors.fullName}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="email">
                  Email <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="email"
                  type="email"
                  className="h-11"
                  value={form.email}
                  onChange={(e) => set('email', e.target.value)}
                  aria-invalid={errors.email ? true : undefined}
                />
                {errors.email ? <p className="text-xs text-destructive">{errors.email}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="phone">
                  Phone <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="phone"
                  type="tel"
                  className="h-11"
                  value={form.phone}
                  onChange={(e) => set('phone', e.target.value)}
                  aria-invalid={errors.phone ? true : undefined}
                />
                {errors.phone ? <p className="text-xs text-destructive">{errors.phone}</p> : null}
              </div>
            </div>

            <AddressAutocomplete
              street={form.street}
              required
              error={errors.street}
              onStreetChange={(value) => set('street', value)}
              onResolved={(address) => {
                setForm((prev) => ({
                  ...prev,
                  street: address.street || prev.street,
                  city: address.city || prev.city,
                  state: address.state || prev.state,
                  zip: address.zip || prev.zip,
                }));
                setErrors((prev) => {
                  const next = { ...prev };
                  delete next.street;
                  delete next.city;
                  delete next.state;
                  delete next.zip;
                  return next;
                });
              }}
            />

            <div className="grid gap-4 sm:grid-cols-2">
              <div className="grid gap-2">
                <Label htmlFor="unit">Unit / apt</Label>
                <Input id="unit" className="h-11" value={form.unit} onChange={(e) => set('unit', e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="zip">
                  ZIP <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="zip"
                  className="h-11"
                  value={form.zip}
                  onChange={(e) => set('zip', e.target.value)}
                  aria-invalid={errors.zip ? true : undefined}
                />
                {errors.zip ? <p className="text-xs text-destructive">{errors.zip}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="city">
                  City <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="city"
                  className="h-11"
                  value={form.city}
                  onChange={(e) => set('city', e.target.value)}
                  aria-invalid={errors.city ? true : undefined}
                />
                {errors.city ? <p className="text-xs text-destructive">{errors.city}</p> : null}
              </div>
              <div className="grid gap-2">
                <Label htmlFor="state">
                  State <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="state"
                  className="h-11"
                  value={form.state}
                  onChange={(e) => set('state', e.target.value)}
                  aria-invalid={errors.state ? true : undefined}
                />
                {errors.state ? <p className="text-xs text-destructive">{errors.state}</p> : null}
              </div>
              <div className="grid gap-2 sm:col-span-2">
                <Label htmlFor="date">Preferred date (optional)</Label>
                <Input
                  id="date"
                  type="date"
                  className="h-11"
                  value={form.preferredDate}
                  onChange={(e) => set('preferredDate', e.target.value)}
                />
              </div>
            </div>

            <p className="rounded-xl bg-muted/50 p-3 text-xs leading-relaxed text-muted-foreground">
              Your estimate is based on the property details and services selected. We confirm size,
              condition, access and availability before confirming your booking.
            </p>
          </section>
        )}

        <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-between">
          {step > 0 ? (
            <Button type="button" variant="outline" className="min-h-11" onClick={goBack}>
              <ArrowLeft className="size-4" />
              Back
            </Button>
          ) : (
            <span />
          )}
          {step < STEPS.length - 1 ? (
            <Button type="button" className="min-h-11" onClick={goNext}>
              Continue
              <ArrowRight className="size-4" />
            </Button>
          ) : (
            <Button type="button" className="min-h-11" onClick={submitRequest} disabled={submitting}>
              {submitting ? (
                <>
                  <LoaderCircle className="size-4 animate-spin" />
                  Submitting…
                </>
              ) : isQuote ? (
                form.service === 'commercial' ? (
                  'Request a Walkthrough'
                ) : (
                  'Request a Quote'
                )
              ) : (
                'Submit estimate request'
              )}
            </Button>
          )}
        </div>
      </div>

      {/* Estimate notice-board panel — light, pinned, no shadow */}
      <aside className="lg:sticky lg:top-24 lg:self-start">
        <div className="relative rounded-sm border border-amber-200/80 bg-[#f7f1e3] px-5 pt-8 pb-5">
          {/* Pin */}
          <div className="absolute top-2 left-1/2 -translate-x-1/2" aria-hidden>
            <span className="relative mx-auto flex size-7 items-center justify-center">
              <span className="absolute size-3 rounded-full bg-red-500 ring-2 ring-red-700/30" />
              <Pin className="relative size-5 rotate-45 text-red-600" strokeWidth={2.25} />
            </span>
          </div>

          <div className="space-y-4">
            <div className="border-b border-amber-900/10 pb-3 text-center">
              <p className="text-xs font-bold tracking-[0.16em] text-primary uppercase">Your estimate</p>
              <p className="mt-1 text-sm text-zinc-600">Price updates with your selections</p>
            </div>

            {/* 1) Estimate cost total first */}
            <div className="rounded-sm border border-amber-900/10 bg-white/80 px-3 py-4 text-center">
              {estimating && !estimate ? (
                <div className="flex items-center justify-center gap-2 text-sm text-zinc-600">
                  <LoaderCircle className="size-4 animate-spin text-primary" />
                  Calculating…
                </div>
              ) : estimate?.status === 'priced' ? (
                <>
                  <div className="flex items-center justify-center gap-2">
                    {estimating ? (
                      <LoaderCircle className="size-4 animate-spin text-primary" />
                    ) : null}
                    <p className="font-serif text-4xl font-semibold tracking-tight text-primary">
                      {formatUsdFromCents(estimate.totalCents)}
                    </p>
                  </div>
                  <p className="mt-1 text-sm text-zinc-600">
                    Est. total incl. tax
                    {estimate.taxRateBps != null
                      ? ` (${(estimate.taxRateBps / 100).toFixed(2)}%)`
                      : ''}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2 text-left text-sm">
                    <div className="rounded-sm border border-amber-900/10 bg-[#fffdf8] px-2.5 py-1.5">
                      <p className="text-xs text-zinc-500">Pre-tax</p>
                      <p className="font-semibold text-zinc-800">
                        {formatUsdFromCents(estimate.subtotalCents)}
                      </p>
                    </div>
                    <div className="rounded-sm border border-amber-900/10 bg-[#fffdf8] px-2.5 py-1.5">
                      <p className="text-xs text-zinc-500">Tax</p>
                      <p className="font-semibold text-zinc-800">
                        {formatUsdFromCents(estimate.taxCents)}
                      </p>
                    </div>
                  </div>
                </>
              ) : estimate?.status === 'quote_required' ? (
                <>
                  <p className="font-serif text-3xl font-semibold tracking-tight text-zinc-800">
                    Custom quote
                  </p>
                  <p className="mt-1 text-sm text-zinc-600">We will confirm pricing after review.</p>
                </>
              ) : (
                <>
                  <p className="font-serif text-3xl font-semibold tracking-tight text-zinc-400">—</p>
                  <p className="mt-1 text-sm text-zinc-600">Select options to see your total.</p>
                </>
              )}
            </div>

            {/* 2) Note + selected details */}
            <div className="rounded-sm border border-dashed border-amber-900/20 bg-[#fffdf8] px-3 py-2.5">
              <p className="text-[11px] font-bold tracking-wide text-amber-900/70 uppercase">Note</p>
              <p className="mt-1 text-sm leading-relaxed text-zinc-700">
                No payment online — submit a request and we confirm the final price with you.
              </p>
              {estimateBody._provisionalSqft ? (
                <p className="mt-2 text-xs text-amber-800/90">
                  Size uses 600 sq. ft. until you enter exact square footage.
                </p>
              ) : null}
              {form.cadence !== 'one_time' && form.service === 'standard' ? (
                <p className="mt-2 text-xs text-zinc-500">
                  Showing first-visit price. {form.cadence} discount applies from visit 2.
                </p>
              ) : null}
              {estimate?.reasons?.length ? (
                <ul className="mt-2 space-y-1 text-xs text-amber-900/80">
                  {estimate.reasons.map((reason) => (
                    <li key={reason}>• {reason}</li>
                  ))}
                </ul>
              ) : null}

              <div className="mt-3 border-t border-amber-900/10 pt-2.5">
                <p className="text-[11px] font-bold tracking-wide text-amber-900/70 uppercase">
                  Your selections
                </p>
                <dl className="mt-2 space-y-1.5 text-sm">
                  {selectionDetails.map((row) => (
                    <div key={row.label} className="flex justify-between gap-3">
                      <dt className="shrink-0 text-zinc-500">{row.label}</dt>
                      <dd className="text-right font-medium text-zinc-800">{row.value}</dd>
                    </div>
                  ))}
                </dl>
              </div>
            </div>

            {estimate?.status === 'priced' && estimate.lines.length > 0 ? (
              <div className="rounded-sm border border-amber-900/10 bg-white/60 px-3 py-2 text-sm">
                <p className="font-medium text-zinc-800">Itemized breakdown</p>
                <ul className="mt-2 max-h-52 space-y-1.5 overflow-auto text-zinc-600">
                  {estimate.lines.map((line) => (
                    <li
                      key={line.id}
                      className="flex justify-between gap-3 border-b border-amber-900/10 pb-1.5 last:border-0"
                    >
                      <span className="min-w-0">{line.label}</span>
                      <span className="shrink-0 font-medium text-zinc-800">
                        {formatUsdFromCents(line.amountCents)}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            ) : null}

            {estimate?.status === 'quote_required' &&
            estimate.commercialReferenceCents != null &&
            form.service === 'commercial' ? (
              <p className="text-xs text-zinc-500">
                Internal starting reference:{' '}
                {formatUsdFromCents(estimate.commercialReferenceCents)} before tax (not a quote).
              </p>
            ) : null}
          </div>
        </div>

        {/* Mobile sticky total — flat, no shadow */}
        {estimate?.status === 'priced' ? (
          <div className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-[#f7f1e3] p-3 lg:hidden">
            <div className="mx-auto flex max-w-lg items-center justify-between gap-3">
              <div>
                <p className="text-xs text-zinc-500">Estimated total</p>
                <p className="text-lg font-semibold text-primary">
                  {formatUsdFromCents(estimate.totalCents)}
                </p>
              </div>
              {step < STEPS.length - 1 ? (
                <Button type="button" className="min-h-11" onClick={goNext}>
                  Continue
                </Button>
              ) : (
                <Button type="button" className="min-h-11" onClick={submitRequest} disabled={submitting}>
                  Submit
                </Button>
              )}
            </div>
          </div>
        ) : null}
      </aside>
    </div>
  );
}
