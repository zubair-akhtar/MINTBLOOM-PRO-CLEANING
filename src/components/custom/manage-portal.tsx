// @polsia:user-owned — authenticated subscriber portal island.
'use client';

import {
  ArrowUpRight,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  ClipboardCheck,
  ExternalLink,
  PauseCircle,
  ShieldCheck,
  Sparkles,
  XCircle,
} from 'lucide-react';
import Link from 'next/link';
import type { FormEvent } from 'react';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import { useIsAdmin } from '@/lib/auth-client';
import {
  BillingPortalResponse,
  type CancellationOutcome,
  type ManageSubscription,
  ManageSubscriptionReschedule,
  ManageSubscriptionResponse,
  type ManageSubscriptionTier,
} from '@/lib/contracts/manage-subscription';
import { type VisitSummary, VisitSummaryList } from '@/lib/contracts/visits';

type PendingAction = 'pause' | 'cancel' | null;

const cadenceOptions: Array<{ value: ManageSubscriptionTier; description: string }> = [
  { value: 'weekly', description: 'A visit every week' },
  { value: 'biweekly', description: 'A visit every two weeks' },
  { value: 'monthly', description: 'A visit once a month' },
];

function titleCase(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function displayDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    year: 'numeric',
    month: 'long',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    timeZone: 'UTC',
    timeZoneName: 'short',
  }).format(new Date(value));
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.cause && typeof error.cause === 'object') {
    const body = error.cause as { error?: unknown };
    if (body.error === 'Unauthorized') return 'unauthorized';
  }
  return 'We could not load your service details. Please try again.';
}

function refundLabel(status: CancellationOutcome['refundStatus']): string {
  if (status === 'refunded') return 'Refunded';
  if (status === 'pending') return 'Refund pending';
  if (status === 'unavailable') return 'Refund not processed automatically';
  return 'No refund applies';
}

function VisitReports({ visits, error }: { visits: VisitSummary[]; error: string | null }) {
  if (error) {
    return (
      <Alert variant="destructive">
        <CircleAlert className="size-4" aria-hidden />
        <AlertTitle>Visit reports unavailable</AlertTitle>
        <AlertDescription>{error}</AlertDescription>
      </Alert>
    );
  }

  if (visits.length === 0) return null;

  return (
    <section className="grid gap-5" aria-labelledby="visit-reports-heading">
      <div>
        <p className="text-eyebrow text-primary">Visit history</p>
        <h2 id="visit-reports-heading" className="mt-2 font-display text-h2">
          Completion reports
        </h2>
        <p className="mt-2 max-w-2xl text-body text-muted-foreground">
          Review the finished details and spot checks for each visit.
        </p>
      </div>
      <div className="grid gap-3">
        {visits.map((visit) => (
          <Card
            key={visit.id}
            className="border-border/80 bg-card/75 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md"
          >
            <CardContent className="flex flex-col gap-4 p-5 sm:flex-row sm:items-center sm:justify-between">
              <div className="flex items-start gap-3">
                <ClipboardCheck className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                <div>
                  <p className="font-semibold">{visit.serviceType}</p>
                  <p className="mt-1 text-small text-muted-foreground">
                    {displayDate(visit.serviceDate)}
                  </p>
                </div>
              </div>
              <Button asChild variant="outline" className="gap-2 sm:shrink-0">
                <Link href={`/visits/${visit.id}`}>
                  View report
                  <ArrowUpRight className="size-4" aria-hidden />
                </Link>
              </Button>
            </CardContent>
          </Card>
        ))}
      </div>
    </section>
  );
}

function OwnerBookingsLink({ isAdmin }: { isAdmin: boolean }) {
  if (!isAdmin) return null;
  return (
    <Button asChild variant="outline" className="w-fit gap-2">
      <Link href="/manage/bookings">
        <CalendarDays className="size-4" aria-hidden />
        Owner bookings
        <ArrowUpRight className="size-4" aria-hidden />
      </Link>
    </Button>
  );
}

function CancellationCard({
  cancellation,
  onOpenBillingPortal,
  openingPortal,
}: {
  cancellation: CancellationOutcome;
  onOpenBillingPortal: () => void;
  openingPortal: boolean;
}) {
  const late = cancellation.outcome === 'late_cancellation_no_refund';
  return (
    <Card className="border-primary/20 bg-card/85 shadow-lg">
      <CardHeader>
        <Badge variant={late ? 'outline' : 'secondary'} className="w-fit gap-2">
          {late ? (
            <XCircle className="size-3.5" aria-hidden />
          ) : (
            <CheckCircle2 className="size-3.5" aria-hidden />
          )}
          {late ? 'Late cancellation recorded' : 'Service request recorded'}
        </Badge>
        <CardTitle className="font-display text-h2">Your future service is paused.</CardTitle>
        <CardDescription>{cancellation.message}</CardDescription>
      </CardHeader>
      <CardContent className="grid gap-4 border-t border-border p-6 text-small">
        <div className="grid gap-1">
          <span className="text-eyebrow">Scheduled service</span>
          <span className="font-semibold">{displayDate(cancellation.scheduledServiceDate)}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-eyebrow">24-hour cutoff</span>
          <span className="font-semibold">{displayDateTime(cancellation.cutoffAt)}</span>
        </div>
        <div className="grid gap-1">
          <span className="text-eyebrow">Paid-service outcome</span>
          <span className="font-semibold">{refundLabel(cancellation.refundStatus)}</span>
        </div>
        <Alert variant={cancellation.refundStatus === 'unavailable' ? 'destructive' : 'default'}>
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>
            {cancellation.refundStatus === 'unavailable'
              ? 'Refund support is required'
              : 'Billing still needs confirmation'}
          </AlertTitle>
          <AlertDescription>
            Open the secure hosted billing portal to stop recurring charges. Mintbloom’s app does
            not accept payment identifiers or refund amounts in the browser.
          </AlertDescription>
        </Alert>
        <Button
          type="button"
          variant="outline"
          className="w-fit gap-2"
          onClick={onOpenBillingPortal}
          disabled={openingPortal}
        >
          <ExternalLink className="size-4" aria-hidden />
          {openingPortal ? 'Opening billing portal…' : 'Open billing portal'}
        </Button>
      </CardContent>
    </Card>
  );
}

export function ManagePortal() {
  const isAdmin = useIsAdmin();
  const [subscription, setSubscription] = useState<ManageSubscription | null>(null);
  const [selectedTier, setSelectedTier] = useState<ManageSubscriptionTier | null>(null);
  const [cancellation, setCancellation] = useState<CancellationOutcome | null>(null);
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [visits, setVisits] = useState<VisitSummary[]>([]);
  const [visitLoadError, setVisitLoadError] = useState<string | null>(null);
  const [confirmAction, setConfirmAction] = useState<PendingAction>(null);
  const [pendingAction, setPendingAction] = useState(false);
  const [rescheduleDate, setRescheduleDate] = useState('');
  const [reschedulePending, setReschedulePending] = useState(false);
  const [rescheduleError, setRescheduleError] = useState<string | null>(null);
  const [rescheduleSaved, setRescheduleSaved] = useState<string | null>(null);
  const [openingPortal, setOpeningPortal] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch('/api/manage/subscription', { schema: ManageSubscriptionResponse })
      .then((result) => {
        if (active) {
          setSubscription(result.subscription);
          setSelectedTier(result.subscription?.cadence ?? null);
          setCancellation(result.cancellation);
          setLoaded(true);
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(errorMessage(error));
          setLoaded(true);
        }
      });
    return () => {
      active = false;
    };
  }, []);

  useEffect(() => {
    let active = true;
    apiFetch('/api/visits', { schema: VisitSummaryList })
      .then((result) => {
        if (active) setVisits(result.visits);
      })
      .catch(() => {
        if (active) setVisitLoadError('Please return to the portal and try again.');
      });
    return () => {
      active = false;
    };
  }, []);

  async function updateSubscription() {
    if (!subscription || !confirmAction) return;
    setPendingAction(true);
    try {
      const result = await apiFetch('/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify({ action: confirmAction, bookingId: subscription.id }),
        schema: ManageSubscriptionResponse,
      });
      setSubscription(result.subscription);
      setCancellation(result.cancellation);
      setConfirmAction(null);
      toast.success(
        confirmAction === 'cancel'
          ? 'Your service cancellation was recorded.'
          : 'Your service pause was recorded.',
      );
    } catch {
      toast.error('We could not update your service. Please try again.');
    } finally {
      setPendingAction(false);
    }
  }

  async function openBillingPortal() {
    setOpeningPortal(true);
    try {
      const result = await apiFetch('/api/manage/billing-portal', {
        method: 'POST',
        schema: BillingPortalResponse,
      });
      window.location.assign(result.url);
    } catch {
      toast.error(
        'The billing portal is unavailable right now. Please try again or contact Mintbloom.',
      );
    } finally {
      setOpeningPortal(false);
    }
  }

  async function rescheduleVisit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!subscription) return;
    if (!/^\d{4}-\d{2}-\d{2}$/.test(rescheduleDate)) {
      setRescheduleSaved(null);
      setRescheduleError('Choose a real calendar date in YYYY-MM-DD format.');
      return;
    }

    const request = ManageSubscriptionReschedule.safeParse({
      action: 'reschedule',
      bookingId: subscription.id,
      targetDate: rescheduleDate,
    });
    if (!request.success) {
      setRescheduleSaved(null);
      setRescheduleError('Choose a real calendar date in YYYY-MM-DD format.');
      return;
    }

    setReschedulePending(true);
    setRescheduleError(null);
    setRescheduleSaved(null);
    try {
      const result = await apiFetch('/api/manage/subscription', {
        method: 'PATCH',
        body: JSON.stringify(request.data),
        schema: ManageSubscriptionResponse,
      });
      setSubscription(result.subscription);
      setCancellation(result.cancellation);
      const savedDate = result.subscription?.nextScheduledVisit ?? rescheduleDate;
      setRescheduleSaved(savedDate);
      setRescheduleDate('');
      toast.success(`Your visit was rescheduled to ${displayDate(savedDate)}.`);
    } catch (error: unknown) {
      const body =
        error instanceof Error && error.cause && typeof error.cause === 'object'
          ? (error.cause as { error?: unknown })
          : null;
      setRescheduleError(
        typeof body?.error === 'string'
          ? body.error
          : 'We could not reschedule your visit. Please try again.',
      );
    } finally {
      setReschedulePending(false);
    }
  }

  if (!loaded) {
    return (
      <main className="container-page grid min-h-[70vh] gap-6 py-section-lg">
        <div className="max-w-2xl">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-12 w-3/4" />
          <Skeleton className="mt-3 h-5 w-full" />
        </div>
        <Skeleton className="h-72 w-full" />
      </main>
    );
  }

  if (loadError === 'unauthorized') {
    return (
      <main className="container-page grid min-h-[70vh] place-items-center py-section-lg">
        <Alert className="max-w-lg">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Sign in to manage your service</AlertTitle>
          <AlertDescription>
            Your service details are private. Sign in with the verified email used for your booking.
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (loadError) {
    return (
      <main className="container-page grid min-h-[70vh] place-items-center py-section-lg">
        <Alert variant="destructive" className="max-w-lg">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Service details unavailable</AlertTitle>
          <AlertDescription>{loadError}</AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!subscription) {
    return (
      <main className="container-page grid min-h-[70vh] gap-10 py-section-lg">
        <OwnerBookingsLink isAdmin={isAdmin} />
        {cancellation ? (
          <CancellationCard
            cancellation={cancellation}
            onOpenBillingPortal={openBillingPortal}
            openingPortal={openingPortal}
          />
        ) : (
          <Card className="w-full max-w-xl border-primary/15 bg-card/80 shadow-lg">
            <CardHeader>
              <Badge variant="outline" className="w-fit gap-2">
                <Sparkles className="size-3.5 text-primary" aria-hidden />
                Subscriber portal
              </Badge>
              <CardTitle className="font-display text-h2">Nothing to manage yet.</CardTitle>
              <CardDescription>
                We could not find a paid recurring service for this verified email address.
              </CardDescription>
            </CardHeader>
          </Card>
        )}
        <VisitReports visits={visits} error={visitLoadError} />
      </main>
    );
  }

  const isPaused = subscription.status === 'paused';
  const requestedTier = selectedTier !== subscription.cadence ? selectedTier : null;
  const cadenceRequestHref =
    requestedTier !== null
      ? `mailto:mintbloom-pro@polsia.app?subject=${encodeURIComponent(`Request to change service cadence to ${titleCase(requestedTier)}`)}&body=${encodeURIComponent(`Hello Mintbloom,\n\nI would like to ask about changing my recurring residential service cadence from ${titleCase(subscription.cadence)} to ${titleCase(requestedTier)}.\n\nPlease confirm the billing impact and effective date before applying any change.`)}`
      : null;
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/70 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page grid gap-10 py-section-lg lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
        <div className="flex flex-col gap-5">
          <p className="text-eyebrow text-primary">Subscriber portal</p>
          <h1 className="font-display text-display tracking-tight">Your service, at a glance.</h1>
          <p className="max-w-xl text-body-lg text-muted-foreground">
            Review the recurring clean attached to your verified booking email. Pause or cancel
            future scheduled service, then use the hosted billing portal to stop recurring charges.
          </p>
          <div className="flex items-center gap-2 text-small text-muted-foreground">
            <CheckCircle2 className="size-4 text-primary" aria-hidden />
            {isPaused ? 'Service is currently paused' : 'Service is currently active'}
          </div>
          <OwnerBookingsLink isAdmin={isAdmin} />
        </div>

        <Card className="overflow-hidden border-primary/15 bg-card/80 shadow-lg backdrop-blur">
          <CardHeader className="border-b border-border bg-primary text-primary-foreground">
            <div className="flex items-start justify-between gap-4">
              <div>
                <CardDescription className="text-primary-foreground/70">
                  Recurring residential service
                </CardDescription>
                <CardTitle className="mt-2 font-display text-h2">
                  {titleCase(subscription.tier)} care
                </CardTitle>
              </div>
              <Badge variant="default" className="bg-primary-foreground/15 text-primary-foreground">
                Active
              </Badge>
            </div>
          </CardHeader>
          <CardContent className="grid gap-6 p-6">
            <section
              className="grid gap-4 border-b border-border pb-6"
              aria-labelledby="cadence-heading"
            >
              <div>
                <h2 id="cadence-heading" className="font-display text-h4">
                  Review service cadence
                </h2>
                <p className="mt-1 text-small text-muted-foreground">
                  Choose a schedule to review. This selection does not update your booking or
                  recurring billing.
                </p>
              </div>
              <fieldset className="grid gap-3">
                <legend className="sr-only">Available service cadences</legend>
                <div className="grid gap-3 sm:grid-cols-3">
                  {cadenceOptions.map((option) => (
                    <label
                      key={option.value}
                      htmlFor={`cadence-${option.value}`}
                      className={`flex cursor-pointer items-start gap-3 rounded-lg border p-4 transition-colors ${
                        selectedTier === option.value
                          ? 'border-primary bg-primary/5 ring-1 ring-primary/30'
                          : 'border-border hover:border-primary/40'
                      }`}
                    >
                      <input
                        id={`cadence-${option.value}`}
                        type="radio"
                        name="service-cadence"
                        value={option.value}
                        checked={selectedTier === option.value}
                        onChange={() => setSelectedTier(option.value)}
                        className="mt-1 size-4 accent-primary"
                      />
                      <span className="grid gap-1">
                        <span className="font-semibold">{titleCase(option.value)} care</span>
                        <span className="text-small text-muted-foreground">
                          {option.description}
                        </span>
                        {subscription.cadence === option.value ? (
                          <Badge variant="secondary" className="mt-1 w-fit">
                            Current cadence
                          </Badge>
                        ) : null}
                      </span>
                    </label>
                  ))}
                </div>
              </fieldset>
              {cadenceRequestHref && requestedTier ? (
                <Alert>
                  <CircleAlert className="size-4" aria-hidden />
                  <AlertTitle>Selected: {titleCase(requestedTier)} care</AlertTitle>
                  <AlertDescription>
                    <p>
                      Billing impact is unavailable, and the effective date is not confirmed. No
                      plan change has been submitted or applied.
                    </p>
                    <Button asChild variant="outline" className="mt-3">
                      <Link href={cadenceRequestHref}>Email Mintbloom about this cadence</Link>
                    </Button>
                  </AlertDescription>
                </Alert>
              ) : null}
            </section>
            <div className="grid gap-6 sm:grid-cols-2">
              <div className="flex items-start gap-3">
                <CalendarDays className="mt-1 size-5 text-primary" aria-hidden />
                <div>
                  <p className="text-eyebrow">Next scheduled visit</p>
                  <p className="mt-1 text-body font-semibold">
                    {displayDate(subscription.nextScheduledVisit)}
                  </p>
                </div>
              </div>
              <div className="flex items-start gap-3">
                <Sparkles className="mt-1 size-5 text-primary" aria-hidden />
                <div>
                  <p className="text-eyebrow">Billing cadence</p>
                  <p className="mt-1 text-body font-semibold">{titleCase(subscription.cadence)}</p>
                </div>
              </div>
            </div>
            <div className="grid gap-3 border-t border-border pt-5">
              <div className="flex items-start gap-3">
                <ShieldCheck className="mt-1 size-5 text-primary" aria-hidden />
                <div>
                  <p className="text-eyebrow">24-hour cancellation cutoff</p>
                  <p className="mt-1 text-body font-semibold">
                    {displayDateTime(subscription.cancellationCutoffAt)}
                  </p>
                  <p className="mt-1 text-small text-muted-foreground">
                    Cancel at least 24 hours before the scheduled service to meet the paid-service
                    refund eligibility rule.
                  </p>
                </div>
              </div>
              <p className="text-small text-muted-foreground">
                Paid service status:{' '}
                {subscription.refundEligibility === 'eligible'
                  ? 'eligible if cancelled now'
                  : subscription.refundEligibility === 'not_eligible'
                    ? 'inside the 24-hour window'
                    : 'not applicable'}
                .
              </p>
            </div>
            <form onSubmit={rescheduleVisit} className="grid gap-3 border-t border-border pt-5">
              <div className="grid gap-1.5">
                <Label htmlFor="reschedule-date">Choose a new visit date</Label>
                <p className="text-small text-muted-foreground">
                  Keep the {titleCase(subscription.cadence)} cadence. Requests are accepted until 24
                  hours before this visit.
                </p>
                <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
                  <Input
                    id="reschedule-date"
                    type="date"
                    value={rescheduleDate}
                    onChange={(event) => {
                      setRescheduleDate(event.target.value);
                      setRescheduleError(null);
                      setRescheduleSaved(null);
                    }}
                    disabled={reschedulePending}
                    aria-describedby="reschedule-date-help"
                    className="sm:max-w-xs"
                  />
                  <Button type="submit" disabled={reschedulePending || rescheduleDate.length === 0}>
                    {reschedulePending ? 'Saving…' : 'Save new date'}
                  </Button>
                </div>
                <p id="reschedule-date-help" className="text-small text-muted-foreground">
                  Weekly and biweekly visits keep their weekday rhythm; monthly visits keep their
                  calendar day.
                </p>
              </div>
              {rescheduleSaved ? (
                <Alert>
                  <CheckCircle2 className="size-4" aria-hidden />
                  <AlertTitle>Visit rescheduled</AlertTitle>
                  <AlertDescription>
                    Your next visit is now scheduled for {displayDate(rescheduleSaved)}.
                  </AlertDescription>
                </Alert>
              ) : null}
              {rescheduleError ? (
                <Alert variant="destructive">
                  <CircleAlert className="size-4" aria-hidden />
                  <AlertTitle>We could not save that date</AlertTitle>
                  <AlertDescription>{rescheduleError}</AlertDescription>
                </Alert>
              ) : null}
            </form>
            <div className="flex flex-wrap gap-3 border-t border-border pt-5">
              <Button
                type="button"
                variant="outline"
                className="gap-2"
                onClick={() => setConfirmAction('pause')}
              >
                <PauseCircle aria-hidden />
                Pause future service
              </Button>
              <Button
                type="button"
                variant="ghost"
                className="gap-2 text-destructive hover:text-destructive"
                onClick={() => setConfirmAction('cancel')}
              >
                <XCircle aria-hidden />
                Cancel service
              </Button>
            </div>
          </CardContent>
        </Card>
      </div>
      <div className="container-page pb-section-lg">
        <VisitReports visits={visits} error={visitLoadError} />
      </div>

      <Dialog
        open={confirmAction !== null}
        onOpenChange={(open) => !open && setConfirmAction(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {confirmAction === 'cancel'
                ? 'Cancel recurring service?'
                : 'Pause recurring service?'}
            </DialogTitle>
            <DialogDescription>
              {confirmAction === 'cancel'
                ? 'This removes future scheduled service from your Mintbloom projection. The exact 24-hour cutoff and paid-service outcome will be recorded before you continue. Finish recurring billing changes in the secure hosted portal.'
                : 'This removes future scheduled service from your Mintbloom projection. If the scheduled service is paid, the 24-hour cutoff and honest refund outcome will be recorded.'}
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button
              type="button"
              variant="outline"
              onClick={() => setConfirmAction(null)}
              disabled={pendingAction}
            >
              Keep active
            </Button>
            <Button type="button" onClick={updateSubscription} disabled={pendingAction}>
              {pendingAction
                ? 'Saving…'
                : confirmAction === 'cancel'
                  ? 'Confirm cancellation'
                  : 'Confirm pause'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </main>
  );
}
