// @polsia:user-owned — private owner bookings calendar/list client island.
'use client';

import {
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleAlert,
  Clock3,
  Mail,
  MapPin,
  Phone,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { useEffect, useMemo, useState } from 'react';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Skeleton } from '@/components/ui/skeleton';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { apiFetch } from '@/lib/api-client';
import {
  type OwnerBookingRecord,
  type OwnerBookingsQuery,
  OwnerBookingsResponse,
} from '@/lib/contracts/owner-bookings';

const INITIAL_FILTERS: OwnerBookingsQuery = { range: 'upcoming', service: 'all', status: 'all' };

const SERVICE_OPTIONS = [
  { value: 'all', label: 'All services and requests' },
  { value: 'booking', label: 'Customer bookings' },
  { value: 'quote_request', label: 'Quote requests' },
  { value: 'builder_inquiry', label: 'Builder requests' },
  { value: 'reclean_request', label: 'Re-clean requests' },
  { value: 'recurringResidential', label: 'Recurring residential' },
  { value: 'oneTimeResidential', label: 'One-time residential' },
  { value: 'deepCleaning', label: 'Deep cleaning' },
  { value: 'moveInMoveOut', label: 'Move-in / move-out' },
  { value: 'officeCommercial', label: 'Office / commercial' },
  { value: 'postConstruction', label: 'Post-construction' },
  { value: 'medicalGradeSanitation', label: 'Medical-grade sanitation' },
] as const;

const STATUS_OPTIONS = [
  { value: 'all', label: 'All statuses' },
  { value: 'active', label: 'Active bookings' },
  { value: 'paid', label: 'Paid' },
  { value: 'payment_pending', label: 'Payment pending' },
  { value: 'quote_requested', label: 'Quote requested' },
  { value: 'quote_contacted', label: 'Customer contacted' },
  { value: 'builder_new', label: 'New builder request' },
  { value: 'builder_reviewing', label: 'Builder under review' },
  { value: 'builder_quoted', label: 'Builder quoted' },
  { value: 'paused', label: 'Paused' },
  { value: 'cancelled', label: 'Cancelled' },
  { value: 'reclean_active', label: 'Needs re-clean' },
  { value: 'reclean_resolved', label: 'Re-clean resolved' },
] as const;

function dateLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'long',
    timeZone: 'UTC',
  }).format(new Date(`${value}T00:00:00Z`));
}

function submissionLabel(value: string): string {
  return new Intl.DateTimeFormat('en-US', {
    dateStyle: 'medium',
    timeStyle: 'short',
  }).format(new Date(value));
}

function todayUtc(): string {
  return new Date().toISOString().slice(0, 10);
}

function errorMessage(error: unknown): string {
  if (error instanceof Error && error.cause && typeof error.cause === 'object') {
    const body = error.cause as { error?: unknown };
    if (body.error === 'Unauthorized')
      return 'Sign in with Bridget’s owner account to view this page.';
    if (body.error === 'Forbidden') return 'This view is limited to the Mintbloom owner account.';
  }
  return 'We could not load the bookings right now. Please try again.';
}

function statusVariant(
  status: OwnerBookingRecord['status'],
): 'default' | 'secondary' | 'outline' | 'destructive' {
  if (status === 'cancelled') return 'destructive';
  if (
    status === 'payment_pending' ||
    status.startsWith('quote_') ||
    status.startsWith('builder_')
  ) {
    return 'outline';
  }
  if (status.startsWith('reclean_')) return 'secondary';
  return 'default';
}

function monthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}`;
}

function monthLabel(date: Date): string {
  return new Intl.DateTimeFormat('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  }).format(date);
}

function calendarCells(month: Date): Array<{ key: string; date: string | null }> {
  const first = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth(), 1));
  const days = new Date(Date.UTC(month.getUTCFullYear(), month.getUTCMonth() + 1, 0)).getUTCDate();
  const cells: Array<{ key: string; date: string | null }> = [];
  const prefix = monthKey(month);
  for (let index = 0; index < first.getUTCDay(); index += 1) {
    cells.push({ key: `${prefix}-blank-${index}`, date: null });
  }
  for (let day = 1; day <= days; day += 1) {
    const date = `${prefix}-${String(day).padStart(2, '0')}`;
    cells.push({ key: date, date });
  }
  return cells;
}

function addressLabel(record: OwnerBookingRecord): string {
  return [
    record.address.line1,
    record.address.line2,
    `${record.address.city}, ${record.address.state} ${record.address.zip}`,
  ]
    .filter(Boolean)
    .join(' · ');
}

function RecordCard({ record }: { record: OwnerBookingRecord }) {
  return (
    <Card className="border-border/80 bg-card/80 transition hover:-translate-y-0.5 hover:border-primary/30 hover:shadow-md">
      <CardContent className="grid gap-4 p-5 sm:grid-cols-[minmax(0,1fr)_auto] sm:items-start">
        <div className="grid gap-3">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-eyebrow text-primary">{record.sourceKind.replaceAll('_', ' ')}</p>
              <h3 className="mt-1 text-h4">{record.serviceLabel}</h3>
              <p className="mt-1 text-small text-muted-foreground">Reference {record.sourceId}</p>
            </div>
            <Badge variant={statusVariant(record.status)}>{record.statusLabel}</Badge>
          </div>
          <div className="grid gap-2 text-small text-muted-foreground sm:grid-cols-2">
            <p className="flex items-start gap-2 text-foreground">
              <Sparkles className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold">{record.customer.name}</span>
                {record.details.organization ? (
                  <span className="block text-muted-foreground">{record.details.organization}</span>
                ) : null}
                <span className="block text-muted-foreground">{record.customer.email}</span>
              </span>
            </p>
            <p className="flex items-start gap-2">
              <MapPin className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>{addressLabel(record)}</span>
            </p>
            <p className="flex items-start gap-2">
              <CalendarDays className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">
                  Service {dateLabel(record.serviceDate)}
                </span>
                {record.secondaryDate ? (
                  <span className="block">
                    {record.secondaryDate.label}: {dateLabel(record.secondaryDate.date)}
                  </span>
                ) : null}
              </span>
            </p>
            <p className="flex items-start gap-2">
              <Clock3 className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
              <span>
                <span className="font-semibold text-foreground">{record.amountLabel}</span>
                <span className="block">Submitted {submissionLabel(record.submissionDate)}</span>
              </span>
            </p>
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 border-t border-border/70 pt-3 text-small text-muted-foreground">
            <span>Payment: {record.paymentStatus.replaceAll('_', ' ')}</span>
            {record.details.cadence ? <span>Cadence: {record.details.cadence}</span> : null}
            {record.details.area ? <span>Area: {record.details.area}</span> : null}
            {record.details.note ? <span>Note: {record.details.note}</span> : null}
          </div>
        </div>
        <div className="flex gap-2 text-small text-muted-foreground sm:flex-col sm:items-end">
          <a
            className="inline-flex items-center gap-1.5 hover:text-primary"
            href={`mailto:${record.customer.email}`}
          >
            <Mail className="size-3.5" aria-hidden />
            Email
          </a>
          {record.customer.phone ? (
            <a
              className="inline-flex items-center gap-1.5 hover:text-primary"
              href={`tel:${record.customer.phone}`}
            >
              <Phone className="size-3.5" aria-hidden />
              Call
            </a>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}

function CalendarView({
  records,
  month,
  onMonthChange,
}: {
  records: OwnerBookingRecord[];
  month: Date;
  onMonthChange: (offset: number) => void;
}) {
  const recordsByDate = useMemo(() => {
    const grouped = new Map<string, OwnerBookingRecord[]>();
    records.forEach((record) => {
      grouped.set(record.serviceDate, [...(grouped.get(record.serviceDate) ?? []), record]);
    });
    return grouped;
  }, [records]);
  const cells = calendarCells(month);
  return (
    <Card className="overflow-hidden border-primary/15 bg-card/80 shadow-lg">
      <CardHeader className="flex-row items-center justify-between border-b border-border/70 bg-primary/[0.06]">
        <div>
          <CardDescription>Service dates and requested work</CardDescription>
          <CardTitle className="mt-1 font-display text-h3">{monthLabel(month)}</CardTitle>
        </div>
        <div className="flex gap-1">
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Previous month"
            onClick={() => onMonthChange(-1)}
          >
            <ChevronLeft aria-hidden />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            aria-label="Next month"
            onClick={() => onMonthChange(1)}
          >
            <ChevronRight aria-hidden />
          </Button>
        </div>
      </CardHeader>
      <CardContent className="p-3 sm:p-5">
        <div className="grid grid-cols-7 gap-1 text-center text-eyebrow text-muted-foreground">
          {['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'].map((day) => (
            <span key={day}>{day}</span>
          ))}
        </div>
        <div className="mt-2 grid grid-cols-7 gap-1">
          {cells.map((cell) => {
            const dayRecords = cell.date ? (recordsByDate.get(cell.date) ?? []) : [];
            return (
              <div
                key={cell.key}
                className="min-h-24 rounded-lg border border-border/60 bg-background/50 p-1.5 sm:min-h-28 sm:p-2"
              >
                {cell.date ? (
                  <p className="text-small font-semibold text-muted-foreground">
                    {Number(cell.date.slice(-2))}
                  </p>
                ) : null}
                <div className="mt-1 grid gap-1">
                  {dayRecords.slice(0, 3).map((record) => (
                    <div
                      key={record.id}
                      className="truncate rounded bg-primary/10 px-1.5 py-1 text-left text-[10px] font-medium text-primary"
                      title={`${record.serviceLabel} · ${record.customer.name}`}
                    >
                      {record.customer.name}
                    </div>
                  ))}
                  {dayRecords.length > 3 ? (
                    <p className="px-1 text-left text-[10px] text-muted-foreground">
                      +{dayRecords.length - 3} more
                    </p>
                  ) : null}
                </div>
              </div>
            );
          })}
        </div>
      </CardContent>
    </Card>
  );
}

export function OwnerBookings() {
  const [filters, setFilters] = useState<OwnerBookingsQuery>(INITIAL_FILTERS);
  const [result, setResult] = useState<OwnerBookingsResponse | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [month, setMonth] = useState(
    () => new Date(Date.UTC(new Date().getUTCFullYear(), new Date().getUTCMonth(), 1)),
  );

  useEffect(() => {
    let active = true;
    setLoadError(null);
    const params = new URLSearchParams({
      range: filters.range,
      service: filters.service,
      status: filters.status,
    });
    apiFetch(`/api/admin/bookings?${params.toString()}`, { schema: OwnerBookingsResponse })
      .then((nextResult) => {
        if (active) setResult(nextResult);
      })
      .catch((error: unknown) => {
        if (active) setLoadError(errorMessage(error));
      });
    return () => {
      active = false;
    };
  }, [filters.range, filters.service, filters.status]);

  const records = result?.items ?? [];
  const today = todayUtc();
  const upcoming = records.filter((record) => record.serviceDate >= today);
  const past = records.filter((record) => record.serviceDate < today);
  const updateFilter = <K extends keyof OwnerBookingsQuery>(
    key: K,
    value: OwnerBookingsQuery[K],
  ) => {
    setFilters((current) => ({ ...current, [key]: value }));
  };

  if (loadError) {
    return (
      <main className="container-page grid min-h-[70vh] place-items-center py-section-lg">
        <Alert variant="destructive" className="max-w-xl">
          <CircleAlert className="size-4" aria-hidden />
          <AlertTitle>Owner bookings unavailable</AlertTitle>
          <AlertDescription className="flex flex-wrap items-center gap-3">
            <span>{loadError}</span>
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setFilters((current) => ({ ...current }))}
            >
              <RefreshCw aria-hidden /> Try again
            </Button>
          </AlertDescription>
        </Alert>
      </main>
    );
  }

  if (!result) {
    return (
      <main className="container-page grid gap-6 py-section-lg">
        <div className="max-w-2xl">
          <Skeleton className="h-5 w-32" />
          <Skeleton className="mt-4 h-12 w-3/4" />
          <Skeleton className="mt-3 h-5 w-full" />
        </div>
        <Skeleton className="h-24 w-full" />
        <Skeleton className="h-96 w-full" />
      </main>
    );
  }

  return (
    <main className="relative min-h-screen overflow-hidden">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0 -z-10 bg-gradient-to-b from-brand-50/80 via-background to-background dark:from-brand-900/20"
      />
      <div className="container-page grid gap-8 py-section-lg">
        <header className="grid gap-3 lg:grid-cols-[1fr_auto] lg:items-end">
          <div>
            <p className="text-eyebrow text-primary">Private operations</p>
            <h1 className="mt-2 font-display text-display tracking-tight">Owner bookings</h1>
            <p className="mt-3 max-w-2xl text-body-lg text-muted-foreground">
              One calm view of paid bookings, checkout attempts, quote requests, builder work, and
              re-clean follow-up.
            </p>
          </div>
          <div className="rounded-xl border border-primary/20 bg-card/80 px-5 py-4 shadow-md">
            <p className="text-eyebrow text-primary">Showing</p>
            <p className="mt-1 text-h3">{result.meta.total} records</p>
            <p className="text-small text-muted-foreground">
              {result.meta.upcomingCount} upcoming · {result.meta.pastCount} past
            </p>
          </div>
        </header>

        <Card className="border-border/80 bg-card/75">
          <CardContent className="grid gap-4 p-4 md:grid-cols-3">
            <div className="grid gap-2">
              <label htmlFor="owner-range" className="text-eyebrow">
                Date range
              </label>
              <Select
                value={filters.range}
                onValueChange={(value) =>
                  updateFilter('range', value as OwnerBookingsQuery['range'])
                }
              >
                <SelectTrigger id="owner-range">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(['upcoming', 'past', 'all'] as const).map((value) => (
                    <SelectItem key={value} value={value}>
                      {value === 'all'
                        ? 'All dates'
                        : value === 'upcoming'
                          ? 'Upcoming first'
                          : 'Past work'}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="owner-service" className="text-eyebrow">
                Service / request
              </label>
              <Select
                value={filters.service}
                onValueChange={(value) =>
                  updateFilter('service', value as OwnerBookingsQuery['service'])
                }
              >
                <SelectTrigger id="owner-service">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {SERVICE_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="grid gap-2">
              <label htmlFor="owner-status" className="text-eyebrow">
                Status
              </label>
              <Select
                value={filters.status}
                onValueChange={(value) =>
                  updateFilter('status', value as OwnerBookingsQuery['status'])
                }
              >
                <SelectTrigger id="owner-status">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {STATUS_OPTIONS.map((option) => (
                    <SelectItem key={option.value} value={option.value}>
                      {option.label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </CardContent>
        </Card>

        {records.length === 0 ? (
          <Card className="border-dashed bg-card/60">
            <CardContent className="grid place-items-center gap-3 py-16 text-center">
              <CalendarDays className="size-8 text-primary" aria-hidden />
              <h2 className="text-h3">No records match these filters.</h2>
              <p className="max-w-md text-body text-muted-foreground">
                New bookings and service requests will appear here as customers submit them.
              </p>
            </CardContent>
          </Card>
        ) : (
          <Tabs defaultValue="calendar" className="grid gap-4">
            <TabsList className="w-fit">
              <TabsTrigger value="calendar">Calendar</TabsTrigger>
              <TabsTrigger value="list">List</TabsTrigger>
            </TabsList>
            <TabsContent value="calendar">
              <CalendarView
                records={records}
                month={month}
                onMonthChange={(offset) =>
                  setMonth(
                    (current) =>
                      new Date(
                        Date.UTC(current.getUTCFullYear(), current.getUTCMonth() + offset, 1),
                      ),
                  )
                }
              />
            </TabsContent>
            <TabsContent value="list" className="grid gap-8">
              {upcoming.length > 0 ? (
                <section className="grid gap-3" aria-labelledby="upcoming-heading">
                  <div>
                    <p className="text-eyebrow text-primary">Next up</p>
                    <h2 id="upcoming-heading" className="mt-1 font-display text-h2">
                      Upcoming work
                    </h2>
                  </div>
                  {upcoming.map((record) => (
                    <RecordCard key={record.id} record={record} />
                  ))}
                </section>
              ) : null}
              {past.length > 0 ? (
                <section className="grid gap-3" aria-labelledby="past-heading">
                  <div>
                    <p className="text-eyebrow text-muted-foreground">History</p>
                    <h2 id="past-heading" className="mt-1 font-display text-h2">
                      Past and completed requests
                    </h2>
                  </div>
                  {past.map((record) => (
                    <RecordCard key={record.id} record={record} />
                  ))}
                </section>
              ) : null}
            </TabsContent>
          </Tabs>
        )}
      </div>
    </main>
  );
}
