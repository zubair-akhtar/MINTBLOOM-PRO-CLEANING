// @polsia:user-owned — Mintbloom residential estimate wizard with optional PayPal checkout.
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
  CreditCard,
  FileText,
  Home,
  LoaderCircle,
  Pin,
  Ruler,
  Sparkles,
  UserRound,
} from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AddressAutocomplete } from '@/components/custom/address-autocomplete';
import { PaypalCheckoutButtons } from '@/components/custom/paypal-checkout-buttons';
import { Button } from '@/components/ui/button';
import { apiFetch } from '@/lib/api-client';
import { formatUsdFromCents } from '@/lib/business/pricing/money';
import {
  bookingPaymentOrderSchema,
  publicPaymentConfigSchema,
  validateCouponResultSchema,
  type PublicPaymentConfig,
} from '@/lib/contracts/payments';
import {
  type EstimateInput,
  type EstimateResponse,
  estimateInputSchema,
  estimateResponseSchema,
  type PublicRateCard,
  publicRateCardSchema,
  type publicServiceIds,
} from '@/lib/contracts/pricing';
import { z } from 'zod';
import styles from './pricing-calculator.module.css';

type ServiceId = (typeof publicServiceIds)[number];
type Condition = 'routine' | 'heavy' | 'severe' | 'unknown';
type Cadence = 'weekly' | 'biweekly' | 'monthly';

type CalculatorForm = {
  service: ServiceId;
  squareFeet: number | '';
  bedrooms: number | '5plus';
  fullBaths: number;
  halfBaths: number;
  kitchens: number;
  offices: number;
  extraRooms: number;
  condition: Condition;
  highWork: boolean;
  heavyConditionApproved: boolean;
  cadence: Cadence | null;
  returningRecurring: boolean;
  ovenCavities: number;
  refrigeratorCount: number;
  cabinetDoors: number;
  baseboards: boolean;
  windowPanes: number;
  windowTracks: number;
  blinds: number;
  linenBeds: number;
  laundryLoads: number;
  dishBlocks: number;
  garageBays: number;
  petHair: boolean;
  rush: boolean;
  travelMiles: number;
  fullName: string;
  email: string;
  phone: string;
  streetAddress: string;
  unit: string;
  city: string;
  state: string;
  zip: string;
  preferredDate: string;
  notes: string;
};

const STEPS = [
  { id: 'property', title: 'Property size', icon: Ruler },
  { id: 'details', title: 'Details & add-ons', icon: ClipboardList },
  { id: 'contact', title: 'Info & address', icon: UserRound },
  { id: 'checkout', title: 'Book or request', icon: CreditCard },
] as const;

const SERVICE_META: { id: ServiceId; label: string; hint?: string; icon: typeof Home }[] = [
  { id: 'standard', label: 'Standard / Basic', icon: Home },
  { id: 'deep', label: 'Deep cleaning', icon: Sparkles },
  { id: 'move', label: 'Move-in / Move-out', icon: Building2 },
  { id: 'airbnb', label: 'Airbnb turnover', icon: CalendarDays },
  { id: 'commercial', label: 'Commercial', hint: 'Walkthrough', icon: Building2 },
  { id: 'postConstruction', label: 'Post-construction', hint: 'Quote', icon: ClipboardList },
];

const BEDROOM_OPTIONS: [string, string][] = [
  ['0', 'Studio (0)'],
  ['1', '1'],
  ['2', '2'],
  ['3', '3'],
  ['4', '4'],
  ['5plus', '5+ (quote)'],
];

const EMPTY_FORM: CalculatorForm = {
  service: 'standard',
  squareFeet: '',
  bedrooms: 0,
  fullBaths: 1,
  halfBaths: 0,
  kitchens: 1,
  offices: 0,
  extraRooms: 0,
  condition: 'routine',
  highWork: false,
  heavyConditionApproved: false,
  cadence: null,
  returningRecurring: false,
  ovenCavities: 0,
  refrigeratorCount: 0,
  cabinetDoors: 0,
  baseboards: false,
  windowPanes: 0,
  windowTracks: 0,
  blinds: 0,
  linenBeds: 0,
  laundryLoads: 0,
  dishBlocks: 0,
  garageBays: 0,
  petHair: false,
  rush: false,
  travelMiles: 0,
  fullName: '',
  email: '',
  phone: '',
  streetAddress: '',
  unit: '',
  city: 'Lubbock',
  state: 'TX',
  zip: '',
  preferredDate: '',
  notes: '',
};

const SERVICE_ALIASES: Record<string, ServiceId> = {
  basicResidential: 'standard',
  oneTimeResidential: 'standard',
  recurringResidential: 'standard',
  deepCleaning: 'deep',
  moveInMoveOut: 'move',
  officeCommercial: 'commercial',
  postConstruction: 'postConstruction',
  medicalGradeSanitation: 'medicalGradeSanitation',
};

type DetailCountKey =
  | 'ovenCavities'
  | 'refrigeratorCount'
  | 'cabinetDoors'
  | 'windowPanes'
  | 'windowTracks'
  | 'blinds'
  | 'linenBeds'
  | 'laundryLoads'
  | 'dishBlocks'
  | 'garageBays';

const DETAIL_COUNTS: readonly [DetailCountKey, string, number, string?][] = [
  ['ovenCavities', 'Oven interiors ($60 each)', 10],
  ['refrigeratorCount', 'Refrigerator interiors ($45 each)', 10],
  ['cabinetDoors', 'Cabinet doors/drawers', 500, '$60 up to 20; then $3 each. Included with Move.'],
  ['windowPanes', 'Interior window panes ($8, $40 min)', 500],
  ['windowTracks', 'Window tracks ($5 each)', 500],
  ['blinds', 'Blinds hand-wipe ($8 each)', 500],
  ['linenBeds', 'Linen / bed changes ($12)', 50],
  ['laundryLoads', 'Laundry loads ($30, max 2)', 2],
  ['dishBlocks', 'Dish blocks ($25 / 15 min, max 2)', 2],
  ['garageBays', 'Garage sweep ($40 / bay)', 10],
];

const serviceLabel = (service: ServiceId) =>
  SERVICE_META.find((item) => item.id === service)?.label ?? 'Residential cleaning';

const isQuoteOnlyService = (service: ServiceId) =>
  service === 'commercial' ||
  service === 'postConstruction' ||
  service === 'medicalGradeSanitation';

function localToday() {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'America/Chicago',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).format(new Date());
}

function asEstimateInput(form: CalculatorForm): EstimateInput | null {
  if (form.squareFeet === '' && !isQuoteOnlyService(form.service)) return null;
  const parsed = estimateInputSchema.safeParse({
    service: form.service,
    // Quote-only calculations return before using property size. Keep the existing
    // estimate contract positive while letting those services skip residential sqft.
    squareFeet: form.squareFeet === '' ? 1 : form.squareFeet,
    bedrooms: form.bedrooms === '5plus' ? 5 : form.bedrooms,
    fullBaths: form.fullBaths,
    halfBaths: form.halfBaths,
    kitchens: form.kitchens,
    offices: form.offices,
    extraRooms: form.extraRooms,
    condition: form.condition,
    highWork: form.highWork,
    heavyConditionApproved: form.heavyConditionApproved,
    cadence: form.service === 'standard' ? form.cadence : null,
    returningRecurring: form.service === 'standard' && form.returningRecurring,
    ovenCavities: form.ovenCavities,
    refrigeratorCount: form.refrigeratorCount,
    cabinetDoors: form.cabinetDoors,
    baseboards: form.baseboards,
    windowPanes: form.windowPanes,
    windowTracks: form.windowTracks,
    blinds: form.blinds,
    linenBeds: form.linenBeds,
    laundryLoads: form.laundryLoads,
    dishBlocks: form.dishBlocks,
    garageBays: form.garageBays,
    petHair: form.petHair,
    rush: form.rush,
    travelMiles: form.travelMiles,
    city: form.city,
    state: form.state,
  });
  return parsed.success ? parsed.data : null;
}

function phoneIsValid(phone: string) {
  if (!/^[+\d() .-]{5,40}$/.test(phone)) return false;
  const digits = phone.replace(/\D/g, '');
  return digits.length >= 10 && digits.length <= 15;
}

export function PricingCalculator({
  initialRateCard,
}: {
  initialRateCard: {
    version: number;
    includedSqFt: number;
    serviceHints: Record<string, string>;
  } | null;
}) {
  const [form, setForm] = useState(EMPTY_FORM);
  const [step, setStep] = useState(0);
  const [today, setToday] = useState('');
  const [rateCard, setRateCard] = useState<PublicRateCard | null>(
    initialRateCard ? publicRateCardSchema.parse(initialRateCard) : null,
  );
  const [rateCardError, setRateCardError] = useState(false);
  const [estimate, setEstimate] = useState<EstimateResponse | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(false);
  const [fieldErrors, setFieldErrors] = useState<Record<string, string>>({});
  const [submitError, setSubmitError] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [checkoutMode, setCheckoutMode] = useState<'quote' | 'online' | null>(null);
  const [paymentConfig, setPaymentConfig] = useState<PublicPaymentConfig | null>(null);
  const [couponCode, setCouponCode] = useState('');
  const [couponDiscountCents, setCouponDiscountCents] = useState(0);
  const [couponMessage, setCouponMessage] = useState('');
  const [bookingNotes, setBookingNotes] = useState('');
  const [reference, setReference] = useState('');
  const attemptId = useRef<string | null>(null);
  const estimateInput = useMemo(() => asEstimateInput(form), [form]);

  useEffect(() => {
    setToday(localToday());
    const queryService = new URLSearchParams(window.location.search).get('service');
    const requested = queryService ? SERVICE_ALIASES[queryService] : undefined;
    if (requested)
      setForm((current) => ({
        ...current,
        service: requested,
        cadence: null,
        returningRecurring: false,
      }));
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/pricing/rate-card', { schema: publicRateCardSchema, cache: 'no-store' })
      .then((result) => {
        if (!active) return;
        setRateCard(result);
        setRateCardError(false);
      })
      .catch(() => {
        if (active && !initialRateCard) setRateCardError(true);
      });
    apiFetch('/api/payments/config', { schema: publicPaymentConfigSchema, cache: 'no-store' })
      .then((config) => {
        if (active) setPaymentConfig(config);
      })
      .catch(() => {
        if (active)
          setPaymentConfig({
            paypalEnabled: false,
            venmoEnabled: false,
            mode: 'sandbox',
            paypalClientId: '',
            onlinePaymentsAvailable: false,
          });
      });
    return () => {
      active = false;
    };
  }, [initialRateCard]);

  useEffect(() => {
    setEstimate(null);
    setEstimateError(false);
    if (!estimateInput || !rateCard) {
      setEstimateLoading(false);
      return;
    }
    let active = true;
    setEstimateLoading(true);
    const timer = window.setTimeout(() => {
      apiFetch('/api/pricing/estimate', {
        method: 'POST',
        body: JSON.stringify(estimateInput),
        schema: estimateResponseSchema,
        cache: 'no-store',
      })
        .then((result) => {
          if (!active) return;
          setEstimate(result);
          setEstimateLoading(false);
          if (result.version !== rateCard.version) {
            apiFetch('/api/pricing/rate-card', {
              schema: publicRateCardSchema,
              cache: 'no-store',
            })
              .then((updated) => active && setRateCard(updated))
              .catch(() => undefined);
          }
        })
        .catch(() => {
          if (!active) return;
          setEstimateError(true);
          setEstimateLoading(false);
        });
    }, 180);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [estimateInput, rateCard]);

  function update<K extends keyof CalculatorForm>(key: K, value: CalculatorForm[K]) {
    setForm((current) => ({ ...current, [key]: value }));
    setFieldErrors((current) => ({ ...current, [key]: '' }));
  }

  function chooseService(service: ServiceId) {
    setForm((current) => ({
      ...current,
      service,
      cadence: null,
      returningRecurring: false,
      ovenCavities: 0,
      refrigeratorCount: 0,
      cabinetDoors: 0,
      baseboards: false,
      windowPanes: 0,
      windowTracks: 0,
      blinds: 0,
      linenBeds: 0,
      laundryLoads: 0,
      dishBlocks: 0,
      garageBays: 0,
      petHair: false,
      rush: false,
    }));
    setFieldErrors({});
  }

  function validateStep(): boolean {
    const errors: Record<string, string> = {};
    if (step === 0 && !isQuoteOnlyService(form.service)) {
      if (form.squareFeet === '')
        errors.squareFeet = 'Enter the home’s square footage to see an estimate.';
      else if (!Number.isInteger(form.squareFeet) || form.squareFeet < 1)
        errors.squareFeet = 'Enter a square footage greater than zero.';
    }
    if (step === 2) {
      if (!form.fullName.trim()) errors.fullName = 'Enter your name.';
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email.trim()))
        errors.email = 'Enter a valid email.';
      if (!form.phone.trim()) errors.phone = 'Phone number is required.';
      else if (!phoneIsValid(form.phone))
        errors.phone = 'Enter a valid phone number with at least 10 digits.';
      if (!form.streetAddress.trim()) errors.streetAddress = 'Enter a street address.';
      if (!form.city.trim()) errors.city = 'Enter a city.';
      if (!/^[A-Za-z]{2}$/.test(form.state.trim())) errors.state = 'Enter a two-letter state.';
      if (!/^\d{5}(?:-\d{4})?$/.test(form.zip.trim())) errors.zip = 'Enter a valid ZIP code.';
      if (form.preferredDate && today && form.preferredDate < today)
        errors.preferredDate = 'Choose today or a future date.';
    }
    if (step === 3) {
      if (!checkoutMode) errors.checkoutMode = 'Choose how you want to continue.';
      if (checkoutMode === 'online') {
        if (!form.preferredDate) errors.preferredDate = 'Choose a preferred appointment date.';
        else if (today && form.preferredDate < today)
          errors.preferredDate = 'Choose today or a future date.';
        if (!paymentConfig?.onlinePaymentsAvailable)
          errors.checkoutMode = 'Online payment is temporarily unavailable. Request a quote instead.';
      }
    }
    setFieldErrors(errors);
    return Object.keys(errors).length === 0;
  }

  function nextStep() {
    if (!validateStep()) return;
    setSubmitError('');
    setStep((current) => Math.min(current + 1, STEPS.length - 1));
  }

  function previousStep() {
    setSubmitError('');
    setStep((current) => Math.max(current - 1, 0));
  }

  const pricedSubtotalCents = estimate?.subtotalCents ?? 0;
  const pricedTaxCents = estimate?.taxCents ?? 0;
  const pricedTotalBeforeCoupon =
    estimate?.status === 'priced' && estimate.totalCents != null
      ? estimate.totalCents
      : Math.max(0, pricedSubtotalCents + pricedTaxCents);
  const payableTotalCents = Math.max(0, pricedTotalBeforeCoupon - couponDiscountCents);

  function buildCustomer() {
    return {
      fullName: form.fullName.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      addressLine1: form.streetAddress.trim(),
      addressLine2: form.unit.trim() || null,
      city: form.city.trim(),
      state: form.state.trim().toUpperCase(),
      zip: form.zip.trim(),
    };
  }

  function buildEstimateSnapshot() {
    return {
      service: form.service,
      lines: estimate?.lines ?? [],
      status: estimate?.status ?? 'quote_required',
      version: estimate?.version ?? rateCard?.version ?? null,
    };
  }

  async function applyCoupon() {
    setCouponMessage('');
    if (!couponCode.trim()) {
      setCouponDiscountCents(0);
      setCouponMessage('Enter a coupon code.');
      return;
    }
    try {
      const result = await apiFetch('/api/coupons/validate', {
        method: 'POST',
        body: JSON.stringify({
          code: couponCode.trim(),
          channel: checkoutMode === 'online' ? 'online' : 'quote',
          subtotalCents: pricedSubtotalCents,
        }),
        schema: validateCouponResultSchema,
      });
      if (!result.valid) {
        setCouponDiscountCents(0);
        setCouponMessage(result.error || 'Invalid coupon.');
        return;
      }
      setCouponDiscountCents(result.discountCents ?? 0);
      setCouponMessage(`Applied ${result.name || result.code}: −${formatUsdFromCents(result.discountCents ?? 0)}`);
    } catch {
      setCouponDiscountCents(0);
      setCouponMessage('Could not validate coupon right now.');
    }
  }

  async function submitQuoteRequest() {
    if (!validateStep()) return;
    setSubmitting(true);
    setSubmitError('');
    attemptId.current ??= crypto.randomUUID();
    try {
      const result = await apiFetch('/api/bookings/quote', {
        method: 'POST',
        body: JSON.stringify({
          customer: buildCustomer(),
          preferredDate: form.preferredDate || null,
          notes: [form.notes.trim(), bookingNotes.trim()].filter(Boolean).join('\n'),
          serviceId: form.service,
          estimateSnapshot: buildEstimateSnapshot(),
          subtotalCents: pricedSubtotalCents,
          taxCents: pricedTaxCents,
          amountCents: payableTotalCents,
          couponCode: couponDiscountCents > 0 ? couponCode.trim() : null,
          idempotencyKey: attemptId.current,
        }),
        schema: z.object({ ok: z.literal(true), order: bookingPaymentOrderSchema }),
      });
      setReference(result.order.reference);
      attemptId.current = null;
    } catch (error) {
      attemptId.current = null;
      setSubmitError(
        error instanceof Error
          ? error.message
          : 'We could not confirm that your request was received. Please retry.',
      );
    } finally {
      setSubmitting(false);
    }
  }

  const createPaypalOrderId = useCallback(async () => {
    if (!validateStep()) throw new Error('Please complete the booking details.');
    attemptId.current ??= crypto.randomUUID();
    const result = await apiFetch('/api/payments/paypal/create-order', {
      method: 'POST',
      body: JSON.stringify({
        customer: buildCustomer(),
        preferredDate: form.preferredDate,
        notes: [form.notes.trim(), bookingNotes.trim()].filter(Boolean).join('\n'),
        serviceId: form.service,
        estimateSnapshot: buildEstimateSnapshot(),
        subtotalCents: pricedSubtotalCents,
        taxCents: pricedTaxCents,
        amountCents: payableTotalCents,
        couponCode: couponDiscountCents > 0 ? couponCode.trim() : null,
        idempotencyKey: attemptId.current,
      }),
      schema: z.object({
        paypalOrderId: z.string(),
        order: bookingPaymentOrderSchema,
      }),
    });
    setReference(result.order.reference);
    return result.paypalOrderId;
  }, [
    bookingNotes,
    couponCode,
    couponDiscountCents,
    form,
    payableTotalCents,
    pricedSubtotalCents,
    pricedTaxCents,
  ]);

  const approvePaypalOrder = useCallback(
    async (paypalOrderId: string) => {
      setSubmitting(true);
      setSubmitError('');
      try {
        const result = await apiFetch('/api/payments/paypal/capture-order', {
          method: 'POST',
          body: JSON.stringify({ paypalOrderId }),
          schema: z.object({ ok: z.literal(true), order: bookingPaymentOrderSchema }),
        });
        setReference(result.order.reference);
        window.location.assign(`/book/confirmed?ref=${encodeURIComponent(result.order.reference)}`);
      } catch (error) {
        setSubmitError(error instanceof Error ? error.message : 'Payment capture failed.');
      } finally {
        setSubmitting(false);
      }
    },
    [],
  );

  const displayTotal =
    estimate?.status === 'priced' && estimate.totalCents !== null
      ? formatUsdFromCents(estimate.totalCents)
      : null;
  const quoteLabel = form.service === 'commercial' ? 'Walkthrough required' : 'Quote required';
  const selectionDetails = useMemo(() => {
    const bedroomLabel =
      form.bedrooms === '5plus' ? '5+' : form.bedrooms === 0 ? 'Studio' : String(form.bedrooms);
    const rows: { label: string; value: string }[] = [
      {
        label: 'Service',
        value: serviceLabel(form.service),
      },
      {
        label: 'Home size',
        value:
          form.squareFeet === ''
            ? 'Not entered yet'
            : `${form.squareFeet.toLocaleString('en-US')} sq ft`,
      },
      { label: 'Bedrooms', value: bedroomLabel },
      { label: 'Baths', value: `${form.fullBaths} full · ${form.halfBaths} half` },
    ];

    if (form.offices > 0) rows.push({ label: 'Offices', value: String(form.offices) });
    if (form.extraRooms > 0)
      rows.push({ label: 'Extra living areas', value: String(form.extraRooms) });
    if (form.kitchens > 1) rows.push({ label: 'Kitchens', value: String(form.kitchens) });
    if (form.service === 'standard')
      rows.push({
        label: 'Frequency',
        value: form.cadence
          ? `${form.cadence[0]?.toUpperCase()}${form.cadence.slice(1)}`
          : 'One time',
      });
    rows.push({
      label: 'Condition',
      value: {
        routine: 'Routine upkeep',
        heavy: 'Heavy buildup',
        severe: 'Severe buildup',
        unknown: 'Not sure',
      }[form.condition],
    });

    const addOns: string[] = [];
    if (form.ovenCavities > 0) addOns.push(`Oven interior ×${form.ovenCavities}`);
    if (form.refrigeratorCount > 0) addOns.push(`Refrigerator interior ×${form.refrigeratorCount}`);
    if (form.cabinetDoors > 0) addOns.push(`Cabinet doors ×${form.cabinetDoors}`);
    if (form.baseboards) addOns.push('Baseboards');
    if (form.windowPanes > 0) addOns.push(`Window panes ×${form.windowPanes}`);
    if (form.windowTracks > 0) addOns.push(`Window tracks ×${form.windowTracks}`);
    if (form.blinds > 0) addOns.push(`Blinds ×${form.blinds}`);
    if (form.linenBeds > 0) addOns.push(`Linen changes ×${form.linenBeds}`);
    if (form.laundryLoads > 0) addOns.push(`Laundry loads ×${form.laundryLoads}`);
    if (form.dishBlocks > 0) addOns.push(`Dish blocks ×${form.dishBlocks}`);
    if (form.garageBays > 0) addOns.push(`Garage bays ×${form.garageBays}`);
    if (form.petHair) addOns.push('Extra pet-hair work');
    if (form.rush) addOns.push('Rush request');
    if (addOns.length > 0) rows.push({ label: 'Add-ons', value: addOns.join(', ') });

    return rows;
  }, [form]);
  const activeRateCardVersion = estimate?.version ?? rateCard?.version ?? '—';

  return (
    <div className={styles.page}>
      <header className={styles.intro}>
        <p className={styles.eyebrow}>Mintbloom Pro · Lubbock-area homes</p>
        <h1 className={styles.title}>A clearer estimate starts with your space.</h1>
        <p className={styles.lede}>
          Tell us about the home and the cleaning you need. You’ll get a live estimate when the
          scope fits the calculator, or a walkthrough review when it needs a closer look.
        </p>
      </header>

      <nav aria-label="Estimate steps" className={styles.stepNav}>
        <ol>
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
                className={styles.step}
                style={{
                  marginLeft: isFirst ? 0 : `-${arrow - 2}px`,
                  zIndex: STEPS.length - index,
                }}
              >
                <button
                  type="button"
                  disabled={index > step}
                  aria-current={index === step ? 'step' : undefined}
                  aria-label={`Step ${index + 1}: ${item.title}`}
                  onClick={() => {
                    if (index < step) {
                      setFieldErrors({});
                      setStep(index);
                    }
                  }}
                  className={`${styles.stepButton} ${reached ? styles.stepCurrent : ''}`}
                  style={{
                    clipPath,
                    filter: isLast ? undefined : 'drop-shadow(2px 0 0 #ffffff)',
                  }}
                >
                  <span className={styles.stepNumber} aria-hidden="true">
                    {index < step ? <Check size={15} /> : index + 1}
                  </span>
                  <span className={styles.stepLabel}>
                    <Icon className={styles.stepIcon} aria-hidden="true" />
                    <span>{item.title}</span>
                  </span>
                </button>
              </li>
            );
          })}
        </ol>
      </nav>

      <div className={styles.layout}>
        <section className={styles.formPanel} aria-labelledby="wizard-heading">
          {reference ? (
            <div className={styles.confirmation}>
              <span className={styles.confirmationIcon} aria-hidden="true">
                <Check size={24} />
              </span>
              <p className={styles.eyebrow}>Request received</p>
              <h2 id="wizard-heading" className={styles.panelTitle}>
                Your estimate is ready for review.
              </h2>
              <p className={styles.panelCopy}>
                Mintbloom Pro will review your details and follow up. This request did not reserve a
                date or take a payment.
              </p>
              <div className={styles.referenceBox}>
                <span>Request reference</span>
                <strong>{reference}</strong>
              </div>
              <Button
                type="button"
                variant="outline"
                onClick={() => window.location.assign('/book')}
              >
                Start another estimate
              </Button>
            </div>
          ) : (
            <>
              <div className={styles.panelHeading}>
                <div>
                  <p className={styles.eyebrow}>Step {step + 1} of {STEPS.length}</p>
                  <h2 id="wizard-heading" className={styles.panelTitle}>
                    {STEPS[step]?.title ?? 'Property size'}
                  </h2>
                </div>
                <span className={styles.panelIndex}>0{step + 1}</span>
              </div>

              {submitError ? (
                <p className={styles.formAlert} role="alert">
                  {submitError}
                </p>
              ) : null}

              {step === 0 ? (
                <div className={styles.formBody}>
                  <fieldset className={styles.serviceFieldset}>
                    <legend className={styles.fieldLegend}>
                      What kind of cleaning do you need?
                    </legend>
                    <div className={styles.serviceGrid}>
                      {SERVICE_META.map((service) => {
                        const Icon = service.icon;
                        const hint = rateCard?.serviceHints[service.id] ?? service.hint;
                        const checked = form.service === service.id;
                        return (
                          <button
                            type="button"
                            key={service.id}
                            aria-pressed={checked}
                            onClick={() => chooseService(service.id)}
                            className={`${styles.serviceCard} ${checked ? styles.serviceSelected : ''}`}
                          >
                            <span className={styles.serviceIcon} aria-hidden="true">
                              <Icon size={18} />
                            </span>
                            <span className={styles.serviceCardTop}>
                              <strong>{service.label}</strong>
                              <span className={styles.serviceCheck} aria-hidden="true">
                                {checked ? <Check size={14} /> : null}
                              </span>
                            </span>
                            <span className={styles.serviceHint}>
                              {hint ?? (rateCardError ? 'Rate unavailable' : 'Loading rate…')}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                  </fieldset>

                  {isQuoteOnlyService(form.service) ? (
                    <p className={styles.includedNote}>
                      {form.service === 'commercial'
                        ? 'A walkthrough will determine the cleaning scope and quote.'
                        : 'A walkthrough will determine the post-construction scope and quote.'}
                    </p>
                  ) : (
                    <div className={styles.fieldGrid}>
                      <NumberField
                        id="square-feet"
                        label="Interior square footage"
                        suffix="sq ft"
                        value={form.squareFeet}
                        min={1}
                        max={100_000}
                        error={fieldErrors.squareFeet}
                        hint={
                          rateCard
                            ? `Required to show a live estimate. The first ${rateCard.includedSqFt.toLocaleString('en-US')} sq. ft. are included in the base.`
                            : 'Required to show a live estimate.'
                        }
                        placeholder="e.g. 1200"
                        required
                        onChange={(value) => update('squareFeet', value)}
                      />
                      <SelectField
                        id="bedrooms"
                        label="Bedrooms"
                        icon={BedDouble}
                        value={String(form.bedrooms)}
                        options={BEDROOM_OPTIONS}
                        hint="Use 0 for a studio."
                        error={fieldErrors.bedrooms}
                        onChange={(value) =>
                          update('bedrooms', value === '5plus' ? '5plus' : Number(value))
                        }
                      />
                      <NumberField
                        id="full-baths"
                        label="Full baths"
                        icon={Bath}
                        value={form.fullBaths}
                        min={0}
                        max={20}
                        error={fieldErrors.fullBaths}
                        required
                        onChange={(value) => update('fullBaths', value || 0)}
                      />
                      <NumberField
                        id="half-baths"
                        label="Half baths"
                        value={form.halfBaths}
                        min={0}
                        max={20}
                        error={fieldErrors.halfBaths}
                        required
                        onChange={(value) => update('halfBaths', value || 0)}
                      />
                      <NumberField
                        id="offices"
                        label="Offices / studies"
                        value={form.offices}
                        min={0}
                        max={20}
                        error={fieldErrors.offices}
                        onChange={(value) => update('offices', value || 0)}
                      />
                      <NumberField
                        id="extra-rooms"
                        label="Extra living rooms"
                        value={form.extraRooms}
                        min={0}
                        max={20}
                        error={fieldErrors.extraRooms}
                        onChange={(value) => update('extraRooms', value || 0)}
                      />
                      <NumberField
                        id="kitchens"
                        label="Kitchens"
                        value={form.kitchens}
                        min={1}
                        max={20}
                        error={fieldErrors.kitchens}
                        onChange={(value) => update('kitchens', value || 1)}
                      />
                    </div>
                  )}
                </div>
              ) : null}

              {step === 1 ? (
                <div className={styles.formBody}>
                  {isQuoteOnlyService(form.service) ? (
                    <p className={styles.includedNote}>
                      {form.service === 'commercial'
                        ? 'Commercial cleaning requires a walkthrough. Residential add-ons and recurring discounts do not apply.'
                        : 'Post-construction work requires a walkthrough and written quote. Residential add-ons do not apply.'}
                    </p>
                  ) : (
                    <>
                      {form.service === 'standard' ? (
                        <div className={styles.frequencyBlock}>
                          <SelectField
                            id="cadence"
                            label="Standard cleaning frequency"
                            value={form.cadence ?? ''}
                            options={[
                              ['', 'One-time visit'],
                              ['weekly', 'Weekly'],
                              ['biweekly', 'Biweekly'],
                              ['monthly', 'Monthly'],
                            ]}
                            onChange={(value) =>
                              update('cadence', value ? (value as Cadence) : null)
                            }
                          />
                          {form.cadence ? (
                            <ToggleField
                              checked={form.returningRecurring}
                              label="This is after my first recurring visit"
                              hint="Your first visit stays at the full rate. Eligible later Standard visits receive the recurring discount."
                              onChange={(checked) => update('returningRecurring', checked)}
                            />
                          ) : null}
                        </div>
                      ) : null}

                      <div className={styles.fieldGrid}>
                        <SelectField
                          id="condition"
                          label="Current condition"
                          value={form.condition}
                          options={[
                            ['routine', 'Routine upkeep'],
                            ['heavy', 'Heavy buildup'],
                            ['severe', 'Severe buildup'],
                            ['unknown', 'Not sure'],
                          ]}
                          onChange={(value) => update('condition', value as Condition)}
                        />
                        <SelectField
                          id="work-level"
                          label="Work level"
                          value={form.highWork ? 'high' : 'standard'}
                          options={[
                            ['standard', 'Standard home cleaning'],
                            ['high', 'High-work project'],
                          ]}
                          onChange={(value) => update('highWork', value === 'high')}
                        />
                      </div>
                      {form.condition === 'heavy' ? (
                        <div className={styles.approvalNotice}>
                          <p>Heavy buildup can add 25% of the core price after approval.</p>
                          <ToggleField
                            checked={form.heavyConditionApproved}
                            label="I approve this allowance for my estimate"
                            onChange={(checked) => update('heavyConditionApproved', checked)}
                          />
                        </div>
                      ) : null}

                      <fieldset className={styles.addOnFieldset}>
                        <legend className={styles.fieldLegend}>Add-ons and extra rooms</legend>
                        <div className={styles.fieldGrid}>
                          {DETAIL_COUNTS.map(([key, label, max, hint]) => (
                            <NumberField
                              key={key}
                              id={key}
                              label={label}
                              value={form[key] as number}
                              min={0}
                              max={max}
                              error={fieldErrors[key]}
                              hint={
                                form.service === 'move' && key === 'ovenCavities'
                                  ? '1 oven included with Move.'
                                  : form.service === 'move' && key === 'refrigeratorCount'
                                    ? '1 fridge included with Move.'
                                    : hint
                              }
                              onChange={(value) => update(key, value || 0)}
                            />
                          ))}
                        </div>
                        <div className={styles.toggleGrid}>
                          {form.service === 'standard' || form.service === 'airbnb' ? (
                            <ToggleField
                              checked={form.baseboards}
                              label="Hand-wiped baseboards ($40 per started 1,000 sq. ft.)"
                              onChange={(checked) => update('baseboards', checked)}
                            />
                          ) : null}
                          {form.service === 'deep' || form.service === 'move' ? (
                            <p className={styles.includedNote}>
                              Hand-wiped baseboards are included.
                            </p>
                          ) : null}
                          <ToggleField
                            checked={form.petHair}
                            label="Extra pet-hair work ($35)"
                            onChange={(checked) => update('petHair', checked)}
                          />
                          <ToggleField
                            checked={form.rush}
                            label="Rush request ($50, pending confirmation)"
                            onChange={(checked) => update('rush', checked)}
                          />
                        </div>
                        {form.service === 'airbnb' ? (
                          <p className={styles.includedNote}>
                            Airbnb turnover includes linen changes for two beds; additional beds are
                            priced separately.
                          </p>
                        ) : null}
                      </fieldset>
                    </>
                  )}
                </div>
              ) : null}

              {step === 2 ? (
                <div className={styles.formBody}>
                  <p className={styles.panelCopy}>
                    We’ll use these details to review the request and follow up. A plain street
                    address is fine; no map lookup is required.
                  </p>
                  <div className={styles.fieldGrid}>
                    <TextField
                      id="full-name"
                      label="Full name"
                      value={form.fullName}
                      required
                      error={fieldErrors.fullName}
                      onChange={(value) => update('fullName', value)}
                    />
                    <TextField
                      id="email"
                      label="Email"
                      type="email"
                      value={form.email}
                      required
                      error={fieldErrors.email}
                      onChange={(value) => update('email', value)}
                    />
                    <TextField
                      id="phone"
                      label="Phone"
                      type="tel"
                      value={form.phone}
                      required
                      error={fieldErrors.phone}
                      hint="Include your area code."
                      onChange={(value) => update('phone', value)}
                    />
                    <TextField
                      id="preferred-date"
                      label="Preferred date"
                      type="date"
                      min={today}
                      value={form.preferredDate}
                      error={fieldErrors.preferredDate}
                      hint="A preference only; we’ll confirm timing after review."
                      onChange={(value) => update('preferredDate', value)}
                    />
                    <AddressAutocomplete
                      street={form.streetAddress}
                      required
                      error={fieldErrors.streetAddress}
                      onStreetChange={(value) => update('streetAddress', value)}
                      onResolved={(address) =>
                        setForm((current) => ({
                          ...current,
                          streetAddress: address.street || current.streetAddress,
                          city: address.city || current.city,
                          state: address.state || current.state,
                          zip: address.zip || current.zip,
                        }))
                      }
                    />
                    <TextField
                      id="unit"
                      label="Unit / apt"
                      value={form.unit}
                      error={fieldErrors.unit}
                      onChange={(value) => update('unit', value)}
                    />
                    <TextField
                      id="city"
                      label="City"
                      value={form.city}
                      required
                      error={fieldErrors.city}
                      onChange={(value) => update('city', value)}
                    />
                    <TextField
                      id="state"
                      label="State"
                      value={form.state}
                      maxLength={2}
                      required
                      error={fieldErrors.state}
                      onChange={(value) => update('state', value.toUpperCase())}
                    />
                    <TextField
                      id="zip"
                      label="ZIP code"
                      value={form.zip}
                      required
                      error={fieldErrors.zip}
                      onChange={(value) => update('zip', value)}
                    />
                    <label className={`${styles.field} ${styles.fullWidth}`} htmlFor="notes">
                      <span className={styles.fieldLabel}>
                        Anything else we should know?{' '}
                        <span className={styles.optional}>(optional)</span>
                      </span>
                      <textarea
                        id="notes"
                        value={form.notes}
                        maxLength={4000}
                        rows={4}
                        className={styles.control}
                        onChange={(event) => update('notes', event.target.value)}
                      />
                      <span className={styles.fieldHint}>
                        Share access details or anything that will help us review the scope.
                      </span>
                    </label>
                  </div>
                </div>
              ) : null}

              {step === 3 ? (
                <div className={styles.formBody}>
                  <p className={styles.panelCopy}>
                    {paymentConfig?.onlinePaymentsAvailable
                      ? `Choose how you want to continue. You can send a free quote request, or pay securely online with PayPal${paymentConfig.venmoEnabled ? ' or Venmo' : ''} to book.`
                      : 'Send a free quote request. Mintbloom will confirm the final price with you.'}
                  </p>
                  <div className={styles.serviceGrid}>
                    <button
                      type="button"
                      className={styles.serviceCard}
                      data-selected={checkoutMode === 'quote' ? 'true' : 'false'}
                      onClick={() => setCheckoutMode('quote')}
                    >
                      <FileText size={18} aria-hidden="true" />
                      <span>
                        <strong>Request a quote</strong>
                        <em>No payment now — we confirm the final price with you.</em>
                      </span>
                      {checkoutMode === 'quote' ? <Check size={16} aria-hidden="true" /> : null}
                    </button>
                    {paymentConfig?.onlinePaymentsAvailable ? (
                      <button
                        type="button"
                        className={styles.serviceCard}
                        data-selected={checkoutMode === 'online' ? 'true' : 'false'}
                        onClick={() => setCheckoutMode('online')}
                      >
                        <CreditCard size={18} aria-hidden="true" />
                        <span>
                          <strong>Pay online & book</strong>
                          <em>Secure PayPal checkout. Book your preferred date now.</em>
                        </span>
                        {checkoutMode === 'online' ? <Check size={16} aria-hidden="true" /> : null}
                      </button>
                    ) : null}
                  </div>
                  {fieldErrors.checkoutMode ? (
                    <p className={styles.fieldError}>{fieldErrors.checkoutMode}</p>
                  ) : null}

                  {checkoutMode ? (
                    <div className={styles.fieldGrid}>
                      {checkoutMode === 'online' ? (
                        <TextField
                          id="book-preferred-date"
                          label="Preferred appointment date"
                          type="date"
                          min={today}
                          value={form.preferredDate}
                          required
                          error={fieldErrors.preferredDate}
                          onChange={(value) => update('preferredDate', value)}
                        />
                      ) : null}
                      <label className={`${styles.field} ${styles.fullWidth}`} htmlFor="booking-notes">
                        <span className={styles.fieldLabel}>
                          Additional booking notes{' '}
                          <span className={styles.optional}>(optional)</span>
                        </span>
                        <textarea
                          id="booking-notes"
                          value={bookingNotes}
                          maxLength={2000}
                          rows={3}
                          className={styles.control}
                          onChange={(event) => setBookingNotes(event.target.value)}
                        />
                      </label>
                      <div className={`${styles.field} ${styles.fullWidth}`}>
                        <span className={styles.fieldLabel}>Coupon code</span>
                        <div className={styles.inlineActions}>
                          <input
                            className={styles.control}
                            value={couponCode}
                            onChange={(event) => setCouponCode(event.target.value.toUpperCase())}
                            placeholder="OPTIONAL"
                          />
                          <Button type="button" variant="outline" onClick={() => void applyCoupon()}>
                            Apply
                          </Button>
                        </div>
                        {couponMessage ? <span className={styles.fieldHint}>{couponMessage}</span> : null}
                      </div>
                      <div className={`${styles.field} ${styles.fullWidth}`}>
                        <p className={styles.panelCopy}>
                          {checkoutMode === 'online' ? 'Due today:' : 'Estimated total:'}{' '}
                          <strong>
                            {estimate?.status === 'priced'
                              ? formatUsdFromCents(payableTotalCents)
                              : 'Quote after review'}
                          </strong>
                          {couponDiscountCents > 0
                            ? ` (saved ${formatUsdFromCents(couponDiscountCents)})`
                            : ''}
                          {checkoutMode === 'quote' ? ' — no payment now.' : ''}
                        </p>
                      </div>
                      {checkoutMode === 'online' &&
                      paymentConfig?.onlinePaymentsAvailable &&
                      estimate?.status === 'priced' ? (
                        <div className={`${styles.field} ${styles.fullWidth}`}>
                          <PaypalCheckoutButtons
                            clientId={paymentConfig.paypalClientId}
                            mode={paymentConfig.mode}
                            venmoEnabled={paymentConfig.venmoEnabled}
                            disabled={submitting || payableTotalCents <= 0}
                            onCreateOrder={createPaypalOrderId}
                            onApprove={approvePaypalOrder}
                            onError={(message) => setSubmitError(message)}
                          />
                        </div>
                      ) : null}
                    </div>
                  ) : null}
                </div>
              ) : null}

              <div className={styles.formFooter}>
                {step > 0 ? (
                  <Button
                    type="button"
                    variant="outline"
                    onClick={previousStep}
                    className={styles.backButton}
                  >
                    <ArrowLeft size={16} aria-hidden="true" /> Back
                  </Button>
                ) : (
                  <span />
                )}
                {step < 3 ? (
                  <Button type="button" onClick={nextStep} className={styles.nextButton}>
                    {step === 0
                      ? 'Continue to details'
                      : step === 1
                        ? 'Continue to your address'
                        : 'Continue to booking'}
                    <ArrowRight size={16} aria-hidden="true" />
                  </Button>
                ) : checkoutMode === 'quote' ? (
                  <Button
                    type="button"
                    onClick={() => void submitQuoteRequest()}
                    disabled={submitting || estimateLoading}
                    className={styles.nextButton}
                  >
                    {submitting ? (
                      <LoaderCircle className="size-4 animate-spin" aria-hidden="true" />
                    ) : null}
                    {submitting
                      ? 'Sending request…'
                      : form.service === 'commercial'
                        ? 'Request Walkthrough'
                        : estimate?.status === 'quote_required'
                          ? 'Request Quote'
                          : 'Send quote request'}
                  </Button>
                ) : (
                  <span className={styles.fieldHint}>
                    {checkoutMode === 'online'
                      ? 'Use the secure PayPal button above to finish booking.'
                      : 'Choose an option to continue.'}
                  </span>
                )}
              </div>
            </>
          )}
        </section>

        <aside className={styles.noticeBoard} aria-label="Estimate summary">
          <span className={styles.pin} aria-hidden="true">
            <Pin size={22} fill="currentColor" />
          </span>
          <div className={styles.boardTotal}>
            <p className={styles.boardEyebrow}>Your estimate</p>
            <strong className={styles.totalValue} aria-live="polite">
              {isQuoteOnlyService(form.service)
                ? quoteLabel
                : form.squareFeet === ''
                  ? '—'
                  : estimateLoading
                    ? 'Updating…'
                    : (displayTotal ?? quoteLabel)}
            </strong>
            <p className={styles.totalContext}>Price updates with your selections</p>
            <p className={styles.boardVersion}>Rate card v{activeRateCardVersion}</p>
          </div>
          <div className={styles.boardNote}>
            <h3>Note</h3>
            <p>
              {paymentConfig?.onlinePaymentsAvailable
                ? 'Request a quote for free, or pay securely online with PayPal to book.'
                : 'Submit a request and Mintbloom Pro will confirm the final price with you.'}
            </p>
            {estimate?.reason ? <p>{estimate.reason}</p> : null}
            {form.service === 'standard' && form.cadence && form.returningRecurring ? (
              <p>
                Showing the eligible {form.cadence} price. The first recurring visit is charged at
                the full rate.
              </p>
            ) : null}
          </div>
          <div className={styles.boardSelections}>
            <h3>Your selections</h3>
            <ul>
              {selectionDetails.map((row) => (
                <li key={row.label}>
                  <span>{row.label}</span>
                  <strong>{row.value}</strong>
                </li>
              ))}
              <li>
                <span>Market</span>
                <strong>
                  {form.city || 'Not entered'}, {form.state || '—'}
                </strong>
              </li>
            </ul>
          </div>
          <div className={styles.boardBreakdown}>
            <h3>Itemized breakdown</h3>
            {estimateError ? (
              <output className={styles.boardEmpty} aria-live="polite">
                Live pricing is unavailable. Please retry before sending your request.
              </output>
            ) : estimateLoading ? (
              <p className={styles.boardEmpty}>Updating from the active rate card…</p>
            ) : form.squareFeet === '' && !isQuoteOnlyService(form.service) ? (
              <p className={styles.boardEmpty}>
                Your itemized estimate appears after you enter the home size.
              </p>
            ) : estimate?.status === 'quote_required' ? (
              <>
                <p className={styles.boardEmpty}>
                  A team member will prepare the itemized quote after reviewing this scope.
                </p>
                {estimate.lines.length ? (
                  <ul className={styles.lineItems}>
                    {estimate.lines.map((line) => (
                      <li key={line.id}>
                        <span>
                          {line.label}
                          {line.pending ? <em>Pending</em> : null}
                        </span>
                        <strong>{formatUsdFromCents(line.amountCents)}</strong>
                      </li>
                    ))}
                  </ul>
                ) : null}
              </>
            ) : estimate?.lines.length ? (
              <ul className={styles.lineItems}>
                {estimate.lines.map((line) => (
                  <li key={line.id}>
                    <span>
                      {line.label}
                      {line.included ? <em>Included</em> : null}
                      {line.pending ? <em>Pending</em> : null}
                    </span>
                    <strong data-total={line.kind === 'total' ? 'true' : undefined}>
                      {line.kind === 'discount' ? '−' : ''}
                      {formatUsdFromCents(line.amountCents)}
                    </strong>
                  </li>
                ))}
              </ul>
            ) : (
              <p className={styles.boardEmpty}>Add your home details to build the breakdown.</p>
            )}
            {estimateError ? (
              <button
                className={styles.retryLink}
                type="button"
                onClick={() => setForm((current) => ({ ...current }))}
              >
                Retry estimate
              </button>
            ) : null}
          </div>
        </aside>
      </div>
      {!estimateLoading && estimate?.status === 'priced' && displayTotal ? (
        <output className={styles.mobileEstimate} aria-label="Current estimate">
          <div className={styles.mobileEstimateTotal}>
            <span>Estimated total</span>
            <strong>{displayTotal}</strong>
          </div>
          <Button
            type="button"
            onClick={() =>
              step < 3
                ? nextStep()
                : checkoutMode === 'quote'
                  ? void submitQuoteRequest()
                  : undefined
            }
            disabled={
              (step === 3 && checkoutMode === 'quote' && (submitting || estimateLoading)) ||
              (step === 3 && checkoutMode !== 'quote')
            }
          >
            {step < 3
              ? 'Continue'
              : submitting
                ? 'Sending…'
                : checkoutMode === 'quote'
                  ? 'Send request'
                  : 'Pay above'}
          </Button>
        </output>
      ) : null}
    </div>
  );
}

function NumberField({
  id,
  label,
  value,
  min,
  max,
  error,
  hint,
  suffix,
  placeholder,
  required = false,
  icon: Icon,
  onChange,
}: {
  id: string;
  label: string;
  value: number | '';
  min: number;
  max: number;
  error?: string;
  hint?: string;
  suffix?: string;
  placeholder?: string;
  required?: boolean;
  icon?: typeof Home;
  onChange: (value: number | '') => void;
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>
        {Icon ? <Icon className={styles.fieldIcon} aria-hidden="true" /> : null}
        {label}
        {required ? <span className={styles.requiredMark}>*</span> : null}
      </span>
      <span className={styles.inputWrap}>
        <input
          id={id}
          type="number"
          min={min}
          max={max}
          step={1}
          inputMode="numeric"
          required={required}
          placeholder={placeholder}
          value={value}
          aria-invalid={!!error}
          aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
          className={`${styles.control} ${suffix ? styles.withSuffix : ''}`}
          onChange={(event) => {
            const raw = event.target.value;
            if (raw === '') {
              onChange('');
              return;
            }
            const parsed = Number(raw);
            onChange(
              Number.isFinite(parsed) ? Math.max(min, Math.min(max, Math.trunc(parsed))) : '',
            );
          }}
        />
        {suffix ? <span className={styles.inputSuffix}>{suffix}</span> : null}
      </span>
      {error ? (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function TextField({
  id,
  label,
  value,
  type = 'text',
  min,
  maxLength,
  error,
  hint,
  placeholder,
  required = false,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  type?: 'text' | 'email' | 'tel' | 'date';
  min?: string;
  maxLength?: number;
  error?: string;
  hint?: string;
  placeholder?: string;
  required?: boolean;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>
        {label}
        {required ? <span className={styles.requiredMark}>*</span> : null}
      </span>
      <input
        id={id}
        type={type}
        min={min}
        maxLength={maxLength}
        placeholder={placeholder}
        required={required}
        value={value}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={styles.control}
        onChange={(event) => onChange(event.target.value)}
      />
      {error ? (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function SelectField({
  id,
  label,
  value,
  options,
  error,
  hint,
  required = false,
  icon: Icon,
  onChange,
}: {
  id: string;
  label: string;
  value: string;
  options: [string, string][];
  error?: string;
  hint?: string;
  required?: boolean;
  icon?: typeof Home;
  onChange: (value: string) => void;
}) {
  return (
    <label className={styles.field} htmlFor={id}>
      <span className={styles.fieldLabel}>
        {Icon ? <Icon className={styles.fieldIcon} aria-hidden="true" /> : null}
        {label}
        {required ? <span className={styles.requiredMark}>*</span> : null}
      </span>
      <select
        id={id}
        value={value}
        required={required}
        aria-invalid={!!error}
        aria-describedby={error ? `${id}-error` : hint ? `${id}-hint` : undefined}
        className={styles.control}
        onChange={(event) => onChange(event.target.value)}
      >
        {options.map(([optionValue, optionLabel]) => (
          <option key={optionValue || 'empty'} value={optionValue}>
            {optionLabel}
          </option>
        ))}
      </select>
      {error ? (
        <span id={`${id}-error`} className={styles.fieldError}>
          {error}
        </span>
      ) : null}
      {!error && hint ? (
        <span id={`${id}-hint`} className={styles.fieldHint}>
          {hint}
        </span>
      ) : null}
    </label>
  );
}

function ToggleField({
  checked,
  label,
  hint,
  onChange,
}: {
  checked: boolean;
  label: string;
  hint?: string;
  onChange: (checked: boolean) => void;
}) {
  return (
    <label className={styles.toggle}>
      <input
        type="checkbox"
        checked={checked}
        onChange={(event) => onChange(event.target.checked)}
      />
      <span className={styles.toggleMark} aria-hidden="true">
        {checked ? <Check size={13} /> : null}
      </span>
      <span className={styles.toggleCopy}>
        <span>{label}</span>
        {hint ? <small>{hint}</small> : null}
      </span>
    </label>
  );
}
