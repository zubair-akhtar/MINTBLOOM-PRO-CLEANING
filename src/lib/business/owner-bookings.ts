// @polsia:user-owned — server-only owner bookings aggregation and projection.
import 'server-only';

import type { z } from 'zod';
import type { serviceTypeSchema } from '@/lib/contracts/bookings';
import {
  type OwnerBookingRecord,
  type OwnerBookingsQuery,
  OwnerBookingsResponse,
  type OwnerBookingsStatus,
} from '@/lib/contracts/owner-bookings';
import { prisma } from '@/lib/db';

// Keep the source labels here so the owner view remains stable if public copy changes.
const SERVICE_LABELS: Record<z.infer<typeof serviceTypeSchema>, string> = {
  basicResidential: 'Basic residential clean',
  oneTimeResidential: 'One-time residential clean',
  recurringResidential: 'Recurring residential clean',
  deepCleaning: 'Deep cleaning',
  moveInMoveOut: 'Move-in / move-out clean',
  officeCommercial: 'Office / commercial clean',
  postConstruction: 'Post-construction clean',
  medicalGradeSanitation: 'Medical-grade sanitation',
};

type BookingServiceType = z.infer<typeof serviceTypeSchema>;
type RecordStatus = Exclude<OwnerBookingsStatus, 'all'>;

type BookingSource = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  serviceType: BookingServiceType;
  cadence: string | null;
  serviceDate: Date;
  paymentAmountCents: number;
  totalAmountCents: number;
  areaClassification: string;
  checkoutSessionId: string;
  status: 'active' | 'paused';
  createdAt: Date;
  cancelledAt: Date | null;
};

type DraftSource = Omit<
  BookingSource,
  'paymentAmountCents' | 'checkoutSessionId' | 'status' | 'cancelledAt'
> & {
  amountCents: number;
  checkoutSessionId: string | null;
  status: 'pending' | 'fulfilled';
};

type QuoteRequestSource = {
  id: string;
  fullName: string;
  email: string;
  phone: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
  bedrooms: number;
  bathrooms: number;
  serviceType: BookingServiceType;
  cadence: string | null;
  serviceDate: Date;
  scope: string | null;
  areaClassification: string;
  status: 'requested' | 'contacted';
  createdAt: Date;
};

type BuilderSource = {
  id: string;
  companyName: string;
  projectContactName: string;
  projectContactEmail: string;
  projectContactPhone: string;
  projectAddressLine1: string;
  projectAddressLine2: string | null;
  projectCity: string;
  projectState: string;
  projectZip: string;
  targetHandoverDate: Date;
  preferredFinalCleanDate: Date;
  isRecurring: boolean;
  notes: string | null;
  budgetaryEstimateSnapshot: unknown;
  status: 'new' | 'reviewing' | 'quoted' | 'closed';
  createdAt: Date;
};

type VisitSource = {
  id: string;
  bookingId: string | null;
  customerEmail: string;
  serviceDate: Date;
  serviceType: string;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  state: string;
  zip: string;
};

type RecleanSource = {
  id: string;
  visitId: string;
  status: 'active' | 'resolved' | 'cancelled';
  reason: string | null;
  createdAt: Date;
};

type FulfillmentSource = {
  bookingId: string;
  amountCents: number;
  paymentIntentId: string | null;
  paidAt: Date | null;
};

export type OwnerBookingSources = {
  bookings: BookingSource[];
  drafts: DraftSource[];
  quoteRequests: QuoteRequestSource[];
  builders: BuilderSource[];
  visits: VisitSource[];
  recleans: RecleanSource[];
  fulfillments: FulfillmentSource[];
  query?: OwnerBookingsQuery;
};

const STATUS_LABELS: Record<RecordStatus, string> = {
  paid: 'Paid',
  active: 'Active',
  paused: 'Paused',
  cancelled: 'Cancelled',
  payment_pending: 'Payment pending',
  quote_requested: 'Quote requested',
  quote_contacted: 'Customer contacted',
  builder_new: 'New request',
  builder_reviewing: 'Under review',
  builder_quoted: 'Quoted',
  builder_closed: 'Closed',
  reclean_active: 'Needs re-clean',
  reclean_resolved: 'Re-clean resolved',
  reclean_cancelled: 'Re-clean cancelled',
};

function dateOnly(date: Date): string {
  return date.toISOString().slice(0, 10);
}

function iso(date: Date): string {
  return date.toISOString();
}

function formatAmount(amountCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amountCents / 100,
  );
}

function statusLabel(status: RecordStatus): string {
  return STATUS_LABELS[status];
}

function address(input: {
  line1: string;
  line2: string | null;
  city: string;
  state: string;
  zip: string;
}) {
  return input;
}

function baseDetails(input: {
  organization?: string | null;
  cadence?: string | null;
  area?: string | null;
  recurring?: boolean;
  bedrooms?: number | null;
  bathrooms?: number | null;
  sourceStatus: string;
  note?: string | null;
}) {
  return {
    organization: input.organization ?? null,
    cadence: input.cadence ?? null,
    area: input.area ?? null,
    recurring: input.recurring ?? false,
    bedrooms: input.bedrooms ?? null,
    bathrooms: input.bathrooms ?? null,
    sourceStatus: input.sourceStatus,
    note: input.note ?? null,
  };
}

function bookingRecord(
  booking: BookingSource,
  fulfillment: FulfillmentSource | undefined,
): OwnerBookingRecord {
  const status: RecordStatus = booking.cancelledAt
    ? 'cancelled'
    : booking.status === 'paused'
      ? 'paused'
      : 'active';
  const amountCents = fulfillment?.amountCents ?? booking.paymentAmountCents;
  return {
    id: `booking:${booking.id}`,
    sourceId: booking.id,
    sourceKind: 'booking',
    customer: { name: booking.fullName, email: booking.email, phone: booking.phone },
    serviceType: booking.serviceType,
    serviceLabel: SERVICE_LABELS[booking.serviceType],
    address: address({
      line1: booking.addressLine1,
      line2: booking.addressLine2,
      city: booking.city,
      state: booking.state,
      zip: booking.zip,
    }),
    serviceDate: dateOnly(booking.serviceDate),
    secondaryDate: null,
    amountCents,
    amountLabel: formatAmount(amountCents),
    status,
    statusLabel: statusLabel(status),
    paymentStatus: 'paid',
    submissionDate: iso(booking.createdAt),
    details: baseDetails({
      cadence: booking.cadence,
      area: booking.areaClassification,
      recurring: booking.cadence !== null,
      bedrooms: booking.bedrooms,
      bathrooms: booking.bathrooms,
      sourceStatus: booking.status,
    }),
  };
}

function draftRecord(draft: DraftSource): OwnerBookingRecord {
  const status: RecordStatus = 'payment_pending';
  return {
    id: `payment_attempt:${draft.id}`,
    sourceId: draft.id,
    sourceKind: 'payment_attempt',
    customer: { name: draft.fullName, email: draft.email, phone: draft.phone },
    serviceType: draft.serviceType,
    serviceLabel: SERVICE_LABELS[draft.serviceType],
    address: address({
      line1: draft.addressLine1,
      line2: draft.addressLine2,
      city: draft.city,
      state: draft.state,
      zip: draft.zip,
    }),
    serviceDate: dateOnly(draft.serviceDate),
    secondaryDate: null,
    amountCents: draft.amountCents,
    amountLabel: formatAmount(draft.amountCents),
    status,
    statusLabel: statusLabel(status),
    paymentStatus: 'payment_pending',
    submissionDate: iso(draft.createdAt),
    details: baseDetails({
      cadence: draft.cadence,
      area: draft.areaClassification,
      recurring: draft.cadence !== null,
      bedrooms: draft.bedrooms,
      bathrooms: draft.bathrooms,
      sourceStatus: draft.status,
    }),
  };
}

function quoteRequestRecord(request: QuoteRequestSource): OwnerBookingRecord {
  const status: RecordStatus =
    request.status === 'contacted' ? 'quote_contacted' : 'quote_requested';
  return {
    id: `quote_request:${request.id}`,
    sourceId: request.id,
    sourceKind: 'quote_request',
    customer: { name: request.fullName, email: request.email, phone: request.phone },
    serviceType: request.serviceType,
    serviceLabel: SERVICE_LABELS[request.serviceType],
    address: address({
      line1: request.addressLine1,
      line2: request.addressLine2,
      city: request.city,
      state: request.state,
      zip: request.zip,
    }),
    serviceDate: dateOnly(request.serviceDate),
    secondaryDate: null,
    amountCents: null,
    amountLabel: 'Quote required',
    status,
    statusLabel: statusLabel(status),
    paymentStatus: 'quote_required',
    submissionDate: iso(request.createdAt),
    details: baseDetails({
      cadence: request.cadence,
      area: request.areaClassification,
      recurring: request.cadence !== null,
      bedrooms: request.bedrooms,
      bathrooms: request.bathrooms,
      sourceStatus: request.status,
      note: request.scope,
    }),
  };
}

function snapshotText(snapshot: unknown, key: string): string | null {
  if (!snapshot || typeof snapshot !== 'object' || !(key in snapshot)) return null;
  const value = (snapshot as Record<string, unknown>)[key];
  return typeof value === 'string' ? value : null;
}

function builderRecord(builder: BuilderSource): OwnerBookingRecord {
  const status = `builder_${builder.status}` as Extract<RecordStatus, `builder_${string}`>;
  const projectRange = snapshotText(builder.budgetaryEstimateSnapshot, 'projectRange');
  return {
    id: `builder_inquiry:${builder.id}`,
    sourceId: builder.id,
    sourceKind: 'builder_inquiry',
    customer: {
      name: builder.projectContactName,
      email: builder.projectContactEmail,
      phone: builder.projectContactPhone,
    },
    serviceType: 'builder_inquiry',
    serviceLabel: 'Builder final-clean request',
    address: address({
      line1: builder.projectAddressLine1,
      line2: builder.projectAddressLine2,
      city: builder.projectCity,
      state: builder.projectState,
      zip: builder.projectZip,
    }),
    serviceDate: dateOnly(builder.preferredFinalCleanDate),
    secondaryDate: { label: 'Handover', date: dateOnly(builder.targetHandoverDate) },
    amountCents: null,
    amountLabel: projectRange ?? 'Budgetary quote',
    status,
    statusLabel: statusLabel(status),
    paymentStatus: 'quote_required',
    submissionDate: iso(builder.createdAt),
    details: baseDetails({
      organization: builder.companyName,
      recurring: builder.isRecurring,
      sourceStatus: builder.status,
      note: builder.notes,
    }),
  };
}

function recleanRecord(
  request: RecleanSource,
  visit: VisitSource,
  booking: BookingSource | undefined,
): OwnerBookingRecord {
  const status = `reclean_${request.status}` as Extract<RecordStatus, `reclean_${string}`>;
  const name = booking?.fullName ?? visit.customerEmail;
  const email = booking?.email ?? visit.customerEmail;
  const paymentStatus = booking ? 'paid' : 'unknown';
  return {
    id: `reclean_request:${request.id}`,
    sourceId: request.id,
    sourceKind: 'reclean_request',
    customer: { name, email, phone: booking?.phone ?? null },
    serviceType: 'reclean_request',
    serviceLabel: 'Re-clean request',
    address: address({
      line1: visit.addressLine1,
      line2: visit.addressLine2,
      city: visit.city,
      state: visit.state,
      zip: visit.zip,
    }),
    serviceDate: dateOnly(visit.serviceDate),
    secondaryDate: null,
    amountCents: booking?.paymentAmountCents ?? null,
    amountLabel: booking ? formatAmount(booking.paymentAmountCents) : 'Review request',
    status,
    statusLabel: statusLabel(status),
    paymentStatus,
    submissionDate: iso(request.createdAt),
    details: baseDetails({
      area: null,
      recurring: booking?.cadence !== null && booking?.cadence !== undefined,
      cadence: booking?.cadence,
      sourceStatus: request.status,
      note: request.reason,
    }),
  };
}

export function normalizeOwnerBookings(
  sources: OwnerBookingSources,
  now = new Date(),
): OwnerBookingsResponse {
  const fulfillments = new Map(sources.fulfillments.map((item) => [item.bookingId, item]));
  const bookingsById = new Map(sources.bookings.map((item) => [item.id, item]));
  const visitsById = new Map(sources.visits.map((item) => [item.id, item]));
  const representedCheckoutSessions = new Set(
    sources.bookings.map((item) => item.checkoutSessionId),
  );

  const records = [
    ...sources.bookings.map((item) => bookingRecord(item, fulfillments.get(item.id))),
    ...sources.drafts
      .filter(
        (item) =>
          !item.checkoutSessionId || !representedCheckoutSessions.has(item.checkoutSessionId),
      )
      .map(draftRecord),
    ...sources.quoteRequests.map(quoteRequestRecord),
    ...sources.builders.map(builderRecord),
    ...sources.recleans.flatMap((request) => {
      const visit = visitsById.get(request.visitId);
      if (!visit) return [];
      return [
        recleanRecord(
          request,
          visit,
          visit.bookingId ? bookingsById.get(visit.bookingId) : undefined,
        ),
      ];
    }),
  ];

  const today = dateOnly(now);
  const isUpcoming = (record: OwnerBookingRecord) => record.serviceDate >= today;
  const filtered = records.filter((record) => {
    const inRange =
      sources.query?.range === undefined ||
      sources.query.range === 'all' ||
      (sources.query.range === 'upcoming' ? isUpcoming(record) : !isUpcoming(record));
    const service = sources.query?.service ?? 'all';
    const inService =
      service === 'all' ||
      (service === 'booking' &&
        (record.sourceKind === 'booking' || record.sourceKind === 'payment_attempt')) ||
      (service === 'quote_request' && record.sourceKind === 'quote_request') ||
      (service === 'builder_inquiry' && record.sourceKind === 'builder_inquiry') ||
      (service === 'reclean_request' && record.sourceKind === 'reclean_request') ||
      record.serviceType === service;
    const status = sources.query?.status ?? 'all';
    const inStatus =
      status === 'all' ||
      (status === 'paid' ? record.paymentStatus === 'paid' : record.status === status);
    return inRange && inService && inStatus;
  });

  filtered.sort((a, b) => {
    const aUpcoming = isUpcoming(a);
    const bUpcoming = isUpcoming(b);
    if (aUpcoming !== bUpcoming) return aUpcoming ? -1 : 1;
    const dateOrder = aUpcoming
      ? a.serviceDate.localeCompare(b.serviceDate)
      : b.serviceDate.localeCompare(a.serviceDate);
    return dateOrder || b.submissionDate.localeCompare(a.submissionDate);
  });

  return OwnerBookingsResponse.parse({
    items: filtered,
    meta: {
      total: filtered.length,
      upcomingCount: filtered.filter(isUpcoming).length,
      pastCount: filtered.filter((record) => !isUpcoming(record)).length,
    },
  });
}

export async function getOwnerBookings(query: OwnerBookingsQuery, now = new Date()) {
  const [bookings, drafts, quoteRequests, builders, visits, recleans, fulfillments] =
    await Promise.all([
      prisma.booking.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
          bedrooms: true,
          bathrooms: true,
          serviceType: true,
          cadence: true,
          serviceDate: true,
          paymentAmountCents: true,
          totalAmountCents: true,
          areaClassification: true,
          checkoutSessionId: true,
          status: true,
          cancelledAt: true,
          createdAt: true,
        },
        orderBy: { serviceDate: 'asc' },
      }),
      prisma.bookingCheckoutDraft.findMany({
        where: { status: 'pending' },
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
          bedrooms: true,
          bathrooms: true,
          serviceType: true,
          cadence: true,
          serviceDate: true,
          amountCents: true,
          totalAmountCents: true,
          areaClassification: true,
          checkoutSessionId: true,
          status: true,
          createdAt: true,
        },
        orderBy: { serviceDate: 'asc' },
      }),
      prisma.bookingQuoteRequest.findMany({
        select: {
          id: true,
          fullName: true,
          email: true,
          phone: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
          bedrooms: true,
          bathrooms: true,
          serviceType: true,
          cadence: true,
          serviceDate: true,
          scope: true,
          areaClassification: true,
          status: true,
          createdAt: true,
        },
        orderBy: { serviceDate: 'asc' },
      }),
      prisma.builderInquiry.findMany({
        select: {
          id: true,
          companyName: true,
          projectContactName: true,
          projectContactEmail: true,
          projectContactPhone: true,
          projectAddressLine1: true,
          projectAddressLine2: true,
          projectCity: true,
          projectState: true,
          projectZip: true,
          targetHandoverDate: true,
          preferredFinalCleanDate: true,
          isRecurring: true,
          notes: true,
          budgetaryEstimateSnapshot: true,
          status: true,
          createdAt: true,
        },
        orderBy: { preferredFinalCleanDate: 'asc' },
      }),
      prisma.visit.findMany({
        select: {
          id: true,
          bookingId: true,
          customerEmail: true,
          serviceDate: true,
          serviceType: true,
          addressLine1: true,
          addressLine2: true,
          city: true,
          state: true,
          zip: true,
        },
      }),
      prisma.recleanRequest.findMany({
        select: { id: true, visitId: true, status: true, reason: true, createdAt: true },
        orderBy: { createdAt: 'desc' },
      }),
      prisma.bookingPaymentFulfillment.findMany({
        select: { bookingId: true, amountCents: true, paymentIntentId: true, paidAt: true },
      }),
    ]);

  return normalizeOwnerBookings(
    {
      bookings,
      drafts,
      quoteRequests,
      builders,
      visits,
      recleans,
      fulfillments,
      query,
    },
    now,
  );
}
