// @polsia:user-owned — shared client/server contract for the booking data plane.
// Keep this file client-safe: it may only depend on zod.
import { z } from 'zod';

export const serviceTypeSchema = z.enum([
  'basicResidential',
  'oneTimeResidential',
  'recurringResidential',
  'deepCleaning',
  'moveInMoveOut',
  'officeCommercial',
  'postConstruction',
  'medicalGradeSanitation',
]);
export const cadenceSchema = z.enum(['weekly', 'biweekly', 'monthly']);
export const areaClassificationSchema = z.enum(['core', 'nearby', 'extended']);
export const pricingStatusSchema = z.enum(['approved', 'starting_price', 'quote_required']);

const calendarDate = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a date in YYYY-MM-DD format')
  .refine((value) => {
    const [yearText, monthText, dayText] = value.split('-');
    const year = Number(yearText);
    const month = Number(monthText);
    const day = Number(dayText);
    const date = new Date(Date.UTC(year, month - 1, day));
    return (
      Number.isInteger(year) &&
      Number.isInteger(month) &&
      Number.isInteger(day) &&
      date.getUTCFullYear() === year &&
      date.getUTCMonth() === month - 1 &&
      date.getUTCDate() === day
    );
  }, 'Choose a valid calendar date');

const homeDetails = {
  bedrooms: z.number().int().min(1, 'Choose at least 1 bedroom').max(5, 'Choose up to 5 bedrooms'),
  bathrooms: z
    .number()
    .int()
    .min(1, 'Choose at least 1 bathroom')
    .max(3, 'Choose up to 3 bathrooms'),
};

const contactAndAddress = {
  fullName: z.string().trim().min(1, 'Full name is required').max(120, 'Full name is too long'),
  email: z.string().trim().email('Enter a valid email address'),
  phone: z.string().trim().min(7, 'Enter a valid phone number').max(30, 'Phone number is too long'),
  addressLine1: z
    .string()
    .trim()
    .min(1, 'Street address is required')
    .max(180, 'Address is too long'),
  addressLine2: z.string().trim().max(180, 'Address is too long').optional(),
  city: z.string().trim().min(1, 'City is required').max(100, 'City is too long'),
  state: z.string().trim().min(2, 'State is required').max(80, 'State is too long'),
  zip: z.string().regex(/^\d{5}$/, 'Enter a 5-digit ZIP code'),
};

export const BookingAddOnSelection = z.object({
  id: z.string().min(1),
  quantity: z.number().int().min(1, 'Choose at least one unit').max(20, 'Choose up to 20 units'),
});

const addOnSelections = z
  .array(BookingAddOnSelection)
  .max(20, 'Choose up to 20 add-ons')
  .superRefine((selections, context) => {
    const seen = new Set<string>();
    selections.forEach((selection, index) => {
      if (seen.has(selection.id)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'id'],
          message: 'Choose each add-on once and adjust its quantity instead',
        });
      }
      seen.add(selection.id);
    });
  });

const serviceSelection = {
  serviceType: serviceTypeSchema,
  cadence: cadenceSchema.optional(),
  addOnSelections,
};

const bookingCreateShape = {
  ...contactAndAddress,
  ...homeDetails,
  ...serviceSelection,
  serviceDate: calendarDate,
  scope: z.string().trim().max(1200, 'Scope details are too long').optional(),
};

function requireRecurringCadence(
  value: {
    serviceType: z.infer<typeof serviceTypeSchema>;
    cadence?: z.infer<typeof cadenceSchema>;
  },
  context: z.RefinementCtx,
) {
  if (value.serviceType === 'recurringResidential' && !value.cadence) {
    context.addIssue({ code: 'custom', path: ['cadence'], message: 'Choose a recurring cadence' });
  }
  if (value.serviceType !== 'recurringResidential' && value.cadence) {
    context.addIssue({
      code: 'custom',
      path: ['cadence'],
      message: 'Cadence is available only for recurring residential service',
    });
  }
}

export const BookingCreate = z.object(bookingCreateShape).superRefine(requireRecurringCadence);

export const BookingQuoteRequest = z
  .object({
    ...homeDetails,
    ...serviceSelection,
    zip: contactAndAddress.zip,
    city: contactAndAddress.city,
    state: contactAndAddress.state,
    scope: z.string().trim().max(1200, 'Scope details are too long').optional(),
  })
  .superRefine(requireRecurringCadence);

export const BookingLine = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  quantity: z.number().int().positive(),
  unitLabel: z.string().min(1),
  amountCents: z.number().int().nonnegative(),
  displayAmount: z.string().min(1),
  pricingStatus: pricingStatusSchema,
  scope: z.string().min(1).nullable(),
  quoteReason: z.string().min(1).nullable(),
});

export const BookingAddOn = z.object({
  id: z.string().min(1),
  label: z.string().min(1),
  description: z.string().min(1),
  unitLabel: z.string().min(1),
  quantityLabel: z.string().min(1),
  minQuantity: z.number().int().positive(),
  maxQuantity: z.number().int().positive(),
  priceCents: z.number().int().positive().nullable(),
  startingPriceCents: z.number().int().positive().nullable(),
  displayPrice: z.string().min(1),
  pricingStatus: pricingStatusSchema,
  scope: z.string().min(1),
  quoteReason: z.string().min(1),
});

export const BookingServiceOption = z.object({
  id: serviceTypeSchema,
  label: z.string().min(1),
  shortDescription: z.string().min(1),
  inclusions: z.array(z.string().min(1)),
  exclusions: z.array(z.string().min(1)),
  pricingStatus: pricingStatusSchema,
  startingPriceCents: z.number().int().positive().nullable(),
  startingPrice: z.string().min(1),
  permittedCadences: z.array(cadenceSchema),
  permittedAreas: z.array(areaClassificationSchema),
});

export const BookingOptionsResponse = z.object({
  services: z.array(BookingServiceOption).min(8),
  addOns: z.array(BookingAddOn).min(13),
  areaNotes: z.object({ core: z.string(), nearby: z.string(), extended: z.string() }),
});

export const BookingSummary = z.object({
  serviceType: serviceTypeSchema,
  serviceLabel: z.string().min(1),
  cadence: cadenceSchema.nullable(),
  cadenceLabel: z.string().nullable(),
  inclusions: z.array(z.string()),
  exclusions: z.array(z.string()),
  selectedAddOns: z.array(BookingLine),
  pricingStatus: pricingStatusSchema,
  baseAmountCents: z.number().int().nonnegative(),
  travelChargeCents: z.number().int().nonnegative(),
  travelPricingStatus: pricingStatusSchema,
  totalAmountCents: z.number().int().nonnegative(),
  baseDisplayAmount: z.string(),
  travelDisplayAmount: z.string(),
  totalDisplayAmount: z.string(),
  areaClassification: areaClassificationSchema,
  lines: z.array(BookingLine),
});

const quotePriced = z.object({ status: z.literal('priced'), summary: BookingSummary });
const quoteRequired = z.object({
  status: z.literal('quote_required'),
  summary: BookingSummary,
  reason: z.string().min(1),
});
export const BookingQuoteResponse = z.discriminatedUnion('status', [quotePriced, quoteRequired]);

export const BookingCheckoutRequest = z
  .object({
    ...bookingCreateShape,
    idempotencyKey: z.string().uuid('Refresh the page and try again'),
  })
  .superRefine(requireRecurringCadence);

export const BookingCheckoutResponse = z.object({
  checkoutUrl: z.string().url(),
  checkoutSessionId: z.string().min(1),
});

export const BookingQuoteRequestSubmission = BookingCreate;
export const BookingQuoteRequestResponse = z.object({
  status: z.literal('quote_requested'),
  requestReference: z.string().min(1),
  summary: BookingSummary,
});

const confirmationPending = z.object({
  status: z.literal('pending'),
  message: z.string(),
});
const confirmationInvalid = z.object({
  status: z.literal('invalid'),
  message: z.string(),
});
const confirmationError = z.object({
  status: z.literal('error'),
  code: z.string(),
  message: z.string(),
});
const confirmationConfirmed = z.object({
  status: z.literal('confirmed'),
  booking: z.object({
    id: z.string(),
    fullName: z.string(),
    email: z.string().email(),
    phone: z.string(),
    addressLine1: z.string(),
    addressLine2: z.string().nullable(),
    city: z.string(),
    state: z.string(),
    zip: z.string(),
    serviceDate: calendarDate,
    summary: BookingSummary,
  }),
  payment: z.object({
    amountCents: z.number().int().positive(),
    displayAmount: z.string(),
    customerEmail: z.string().email().nullable(),
    paidAt: z.string().nullable(),
  }),
});

export const BookingConfirmationResponse = z.discriminatedUnion('status', [
  confirmationPending,
  confirmationInvalid,
  confirmationError,
  confirmationConfirmed,
]);

export type BookingAddOnSelection = z.infer<typeof BookingAddOnSelection>;
export type BookingCreate = z.infer<typeof BookingCreate>;
export type BookingLine = z.infer<typeof BookingLine>;
export type BookingQuoteRequest = z.infer<typeof BookingQuoteRequest>;
export type BookingSummary = z.infer<typeof BookingSummary>;
export type BookingQuoteResponse = z.infer<typeof BookingQuoteResponse>;
export type BookingCheckoutRequest = z.infer<typeof BookingCheckoutRequest>;
export type BookingConfirmationResponse = z.infer<typeof BookingConfirmationResponse>;
export type BookingOptionsResponse = z.infer<typeof BookingOptionsResponse>;
