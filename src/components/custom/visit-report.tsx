// @polsia:user-owned — customer-facing visit report island.
'use client';

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  CircleAlert,
  MapPin,
  RefreshCw,
} from 'lucide-react';
import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { toast } from 'sonner';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import { apiFetch } from '@/lib/api-client';
import {
  type RecleanRequest,
  RecleanRequestResponse,
  type VisitReport as VisitReportData,
  VisitReportResponse,
} from '@/lib/contracts/visits';

type VisitReportProps = { visitId: string };

function displayDate(value: string): string {
  return new Intl.DateTimeFormat('en-US', { dateStyle: 'long', timeZone: 'UTC' }).format(
    new Date(`${value}T00:00:00Z`),
  );
}

function displayDateTime(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function statusLabel(status: VisitReportData['completionStatus']): string {
  if (status === 'needs_attention') return 'Needs attention';
  if (status === 'cancelled') return 'Cancelled';
  return 'Completed';
}

function errorKind(error: unknown): 'unauthorized' | 'not-found' | 'generic' {
  if (error instanceof Error && error.message.includes('(401)')) return 'unauthorized';
  if (error instanceof Error && error.message.includes('(404)')) return 'not-found';
  return 'generic';
}

function VisitLoading() {
  return (
    <main className="container-page grid min-h-[70vh] gap-8 py-section-lg">
      <div className="max-w-2xl space-y-4">
        <Skeleton className="h-5 w-36" />
        <Skeleton className="h-14 w-4/5" />
        <Skeleton className="h-5 w-full" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
        <Skeleton className="h-80" />
        <Skeleton className="h-80" />
      </div>
    </main>
  );
}

function ReportError({ kind }: { kind: ReturnType<typeof errorKind> }) {
  const copy =
    kind === 'unauthorized'
      ? {
          title: 'Sign in to view this report',
          description:
            'Visit reports are private. Sign in with the verified email used for your booking.',
        }
      : kind === 'not-found'
        ? {
            title: 'Visit report unavailable',
            description: 'We could not find a visit report connected to your account.',
          }
        : {
            title: 'Report unavailable',
            description:
              'We could not load this visit report. Please try again from your manage portal.',
          };

  return (
    <main className="container-page grid min-h-[70vh] place-items-center py-section-lg">
      <Alert variant={kind === 'generic' ? 'destructive' : 'default'} className="max-w-xl">
        <CircleAlert className="size-4" aria-hidden />
        <AlertTitle>{copy.title}</AlertTitle>
        <AlertDescription>{copy.description}</AlertDescription>
      </Alert>
    </main>
  );
}

function Address({ visit }: { visit: VisitReportData }) {
  return (
    <div className="flex gap-3">
      <MapPin className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
      <div className="text-body text-muted-foreground">
        <p className="font-medium text-foreground">Service address</p>
        <p>{visit.address.addressLine1}</p>
        {visit.address.addressLine2 ? <p>{visit.address.addressLine2}</p> : null}
        <p>
          {visit.address.city}, {visit.address.state} {visit.address.zip}
        </p>
      </div>
    </div>
  );
}

function RecleanState({ request }: { request: RecleanRequest }) {
  return (
    <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-4">
      <CheckCircle2 className="mt-0.5 size-5 shrink-0 text-primary" aria-hidden />
      <div>
        <p className="font-semibold text-foreground">Re-clean request received</p>
        <p className="mt-1 text-small text-muted-foreground">
          We have your request and will follow up using the contact details on your booking.
        </p>
        <p className="mt-2 text-caption text-muted-foreground">
          Submitted {displayDateTime(request.createdAt)}
        </p>
      </div>
    </div>
  );
}

export function VisitReport({ visitId }: VisitReportProps) {
  const [visit, setVisit] = useState<VisitReportData | null>(null);
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<'unauthorized' | 'not-found' | 'generic'>('generic');
  const [requesting, setRequesting] = useState(false);

  useEffect(() => {
    let active = true;
    apiFetch(`/api/visits/${encodeURIComponent(visitId)}`, { schema: VisitReportResponse })
      .then((result) => {
        if (active) {
          setVisit(result.visit);
          setLoadState('ready');
        }
      })
      .catch((error: unknown) => {
        if (active) {
          setLoadError(errorKind(error));
          setLoadState('error');
        }
      });
    return () => {
      active = false;
    };
  }, [visitId]);

  async function requestReclean() {
    setRequesting(true);
    try {
      const result = await apiFetch(`/api/visits/${encodeURIComponent(visitId)}/re-clean`, {
        method: 'POST',
        body: JSON.stringify({}),
        schema: RecleanRequestResponse,
      });
      setVisit((current) =>
        current ? { ...current, activeRecleanRequest: result.recleanRequest } : current,
      );
    } catch (error: unknown) {
      if (error instanceof Error && error.message.includes('(409)')) {
        toast('A re-clean request is already active for this visit.');
      } else {
        toast.error('We could not submit your re-clean request. Please try again.');
      }
    } finally {
      setRequesting(false);
    }
  }

  if (loadState === 'loading') return <VisitLoading />;
  if (loadState === 'error') return <ReportError kind={loadError} />;
  if (!visit) return <ReportError kind="generic" />;

  const hasRequest = visit.activeRecleanRequest !== null;
  return (
    <main className="relative overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/80 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page grid gap-10 py-section-lg">
        <div className="flex flex-col gap-5">
          <Button
            asChild
            variant="ghost"
            size="sm"
            className="w-fit gap-2 px-0 text-muted-foreground"
          >
            <Link href="/manage">
              <ArrowLeft className="size-4" aria-hidden />
              Back to manage portal
            </Link>
          </Button>
          <div className="flex flex-col gap-4 md:flex-row md:items-end md:justify-between">
            <div className="max-w-3xl space-y-3">
              <p className="text-eyebrow text-primary">Visit report</p>
              <h1 className="font-display text-display tracking-tight">
                A clear finish, room by room.
              </h1>
              <p className="max-w-2xl text-body-lg text-muted-foreground">
                Here is the completion snapshot from your Mintbloom visit, including the spot-check
                photos captured by the team.
              </p>
            </div>
            <Badge
              variant={visit.completionStatus === 'cancelled' ? 'outline' : 'default'}
              className="w-fit gap-2 px-3 py-1.5 text-small"
            >
              <CheckCircle2 className="size-4" aria-hidden />
              {statusLabel(visit.completionStatus)}
            </Badge>
          </div>
        </div>

        <div className="grid gap-6 lg:grid-cols-[1.25fr_0.75fr]">
          <Card className="overflow-hidden border-primary/15 bg-card/85 shadow-lg backdrop-blur">
            <CardHeader className="border-b border-border bg-primary text-primary-foreground">
              <CardDescription className="text-primary-foreground/70">
                Completion summary
              </CardDescription>
              <CardTitle className="font-display text-h2">Your home is back in order.</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6 p-6 sm:p-8">
              <p className="text-body-lg leading-relaxed text-foreground">
                {visit.completionSummary ??
                  'Your service team completed the visit and recorded the details below.'}
              </p>
              <div className="grid gap-5 border-t border-border pt-6 sm:grid-cols-2">
                <div className="flex gap-3">
                  <CalendarDays className="mt-1 size-5 shrink-0 text-primary" aria-hidden />
                  <div>
                    <p className="text-eyebrow">Service date</p>
                    <p className="mt-1 font-semibold">{displayDate(visit.serviceDate)}</p>
                  </div>
                </div>
                <div>
                  <p className="text-eyebrow">Service type</p>
                  <p className="mt-1 font-semibold">{visit.serviceType}</p>
                </div>
              </div>
              {visit.completedAt ? (
                <p className="text-small text-muted-foreground">
                  Completed {displayDateTime(visit.completedAt)}
                </p>
              ) : null}
            </CardContent>
          </Card>

          <Card className="border-border/80 bg-card/70 shadow-md">
            <CardHeader>
              <CardDescription>Visit details</CardDescription>
              <CardTitle className="font-display text-h3">The essentials</CardTitle>
            </CardHeader>
            <CardContent className="space-y-6">
              <Address visit={visit} />
              {visit.serviceDetails ? (
                <div className="border-t border-border pt-5">
                  <p className="text-eyebrow">Scope notes</p>
                  <p className="mt-2 text-body text-muted-foreground">{visit.serviceDetails}</p>
                </div>
              ) : null}
            </CardContent>
          </Card>
        </div>

        <section className="space-y-5" aria-labelledby="spot-check-heading">
          <div className="flex items-end justify-between gap-4">
            <div>
              <p className="text-eyebrow text-primary">Spot checks</p>
              <h2 id="spot-check-heading" className="mt-2 font-display text-h2">
                A closer look at the finish
              </h2>
            </div>
            <p className="text-small text-muted-foreground">{visit.photos.length} photos</p>
          </div>
          {visit.photos.length > 0 ? (
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
              {visit.photos.map((photo) => (
                <figure
                  key={photo.id}
                  className="group overflow-hidden rounded-xl border border-border bg-card shadow-sm"
                >
                  <div className="relative aspect-[4/3] overflow-hidden bg-muted">
                    <Image
                      src={photo.url}
                      alt={photo.alt}
                      fill
                      sizes="(min-width: 1024px) 33vw, (min-width: 640px) 50vw, 100vw"
                      className="object-cover transition duration-500 group-hover:scale-105"
                      unoptimized
                    />
                  </div>
                  {photo.caption ? (
                    <figcaption className="p-4 text-small text-muted-foreground">
                      {photo.caption}
                    </figcaption>
                  ) : null}
                </figure>
              ))}
            </div>
          ) : (
            <Card className="border-dashed bg-card/50">
              <CardContent className="p-6 text-body text-muted-foreground">
                Spot-check photos will appear here when they are available.
              </CardContent>
            </Card>
          )}
        </section>

        <Card className="border-primary/20 bg-primary/5 shadow-md">
          <CardContent className="flex flex-col gap-5 p-6 sm:flex-row sm:items-center sm:justify-between sm:p-8">
            <div className="max-w-2xl">
              <p className="text-eyebrow text-primary">Something need another pass?</p>
              <h2 className="mt-2 font-display text-h3">Request a re-clean</h2>
              <p className="mt-2 text-body text-muted-foreground">
                Send one request for this visit and our team will follow up. You can add context
                when you contact us after submitting.
              </p>
            </div>
            {hasRequest && visit.activeRecleanRequest ? (
              <RecleanState request={visit.activeRecleanRequest} />
            ) : (
              <Button
                type="button"
                size="lg"
                className="shrink-0 gap-2"
                onClick={requestReclean}
                disabled={requesting}
              >
                <RefreshCw className="size-4" aria-hidden />
                {requesting ? 'Sending request…' : 'Request a re-clean'}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>
    </main>
  );
}
