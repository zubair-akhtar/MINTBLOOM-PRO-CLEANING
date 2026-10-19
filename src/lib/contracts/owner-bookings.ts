// @polsia:user-owned — shared owner bookings contract for the admin data plane.
// Keep this module zod-only so the route and client island cannot drift.
import { z } from 'zod';

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Expected a date in YYYY-MM-DD format')
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Expected a valid calendar date');

const isoDateTime = z.string().datetime({ offset: true });

export const ownerBookingsRangeSchema = z.enum(['upcoming', 'past', 'all']);
export const ownerBookingsServiceSchema = z.enum([
  'all',
  'booking',
  'quote_request',
  'builder_inquiry',
  'reclean_request',
  'basicResidential',
  'oneTimeResidential',
  'recurringResidential',
  'deepCleaning',
  'moveInMoveOut',
  'officeCommercial',
  'postConstruction',
  'medicalGradeSanitation',
]);
export const ownerBookingsStatusSchema = z.enum([
  'all',
  'paid',
  'active',
  'paused',
  'cancelled',
  'payment_pending',
  'quote_requested',
  'quote_contacted',
  'builder_new',
  'builder_reviewing',
  'builder_quoted',
  'builder_closed',
  'reclean_active',
  'reclean_resolved',
  'reclean_cancelled',
]);

export const OwnerBookingsQuery = z.object({
  range: ownerBookingsRangeSchema.default('upcoming'),
  service: ownerBookingsServiceSchema.default('all'),
  status: ownerBookingsStatusSchema.default('all'),
});

export const OwnerBookingSourceKind = z.enum([
  'booking',
  'payment_attempt',
  'quote_request',
  'builder_inquiry',
  'reclean_request',
]);

const address = z.object({
  line1: z.string().min(1),
  line2: z.string().nullable(),
  city: z.string().min(1),
  state: z.string().min(1),
  zip: z.string().min(1),
});

export const OwnerBookingRecord = z.object({
  id: z.string().min(1),
  sourceId: z.string().min(1),
  sourceKind: OwnerBookingSourceKind,
  customer: z.object({
    name: z.string().min(1),
    email: z.string().email(),
    phone: z.string().nullable(),
  }),
  serviceType: z.string().min(1),
  serviceLabel: z.string().min(1),
  address,
  serviceDate: calendarDate,
  secondaryDate: z.object({ label: z.string().min(1), date: calendarDate }).nullable(),
  amountCents: z.number().int().nonnegative().nullable(),
  amountLabel: z.string().min(1),
  status: ownerBookingsStatusSchema.exclude(['all']),
  statusLabel: z.string().min(1),
  paymentStatus: z.enum(['paid', 'payment_pending', 'quote_required', 'not_applicable', 'unknown']),
  submissionDate: isoDateTime,
  details: z.object({
    organization: z.string().nullable(),
    cadence: z.string().nullable(),
    area: z.string().nullable(),
    recurring: z.boolean(),
    bedrooms: z.number().int().nullable(),
    bathrooms: z.number().int().nullable(),
    sourceStatus: z.string().min(1),
    note: z.string().nullable(),
  }),
});

export const OwnerBookingsResponse = z.object({
  items: z.array(OwnerBookingRecord),
  meta: z.object({
    total: z.number().int().nonnegative(),
    upcomingCount: z.number().int().nonnegative(),
    pastCount: z.number().int().nonnegative(),
  }),
});

export type OwnerBookingsQuery = z.infer<typeof OwnerBookingsQuery>;
export type OwnerBookingRecord = z.infer<typeof OwnerBookingRecord>;
export type OwnerBookingsResponse = z.infer<typeof OwnerBookingsResponse>;
export type OwnerBookingsStatus = z.infer<typeof ownerBookingsStatusSchema>;
