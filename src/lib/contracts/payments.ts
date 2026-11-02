// @polsia:user-owned — Zod contracts for PayPal booking payments + coupons.
import { z } from 'zod';

export const paymentModeSchema = z.enum(['sandbox', 'live']);
export const couponAppliesToSchema = z.enum(['online_only', 'quote_and_online']);
export const bookingPaymentChannelSchema = z.enum(['quote', 'online']);
export const bookingPaymentStatusSchema = z.enum([
  'quote_requested',
  'pending_payment',
  'paid',
  'testing_payment',
  'failed',
  'cancelled',
]);

export const publicPaymentConfigSchema = z.object({
  paypalEnabled: z.boolean(),
  venmoEnabled: z.boolean(),
  mode: paymentModeSchema,
  paypalClientId: z.string(),
  onlinePaymentsAvailable: z.boolean(),
});

export const paymentSettingsAdminSchema = z.object({
  mode: paymentModeSchema,
  paypalEnabled: z.boolean(),
  venmoEnabled: z.boolean(),
  paypalClientId: z.string(),
  paypalClientSecretSet: z.boolean(),
  paypalWebhookId: z.string(),
  updatedAt: z.string().datetime(),
});

export const savePaymentSettingsSchema = z.object({
  mode: paymentModeSchema,
  paypalEnabled: z.boolean(),
  venmoEnabled: z.boolean(),
  paypalClientId: z.string().trim().max(200),
  paypalClientSecret: z.string().trim().max(400).optional(),
  paypalWebhookId: z.string().trim().max(200).optional(),
  clearSecret: z.boolean().optional(),
});

export const couponSchema = z.object({
  id: z.string(),
  code: z.string(),
  name: z.string(),
  percentOff: z.number().int().min(1).max(100).nullable(),
  amountOffCents: z.number().int().positive().nullable(),
  maxRedemptions: z.number().int().positive().nullable(),
  redemptionCount: z.number().int().nonnegative(),
  startsAt: z.string().datetime().nullable(),
  endsAt: z.string().datetime().nullable(),
  appliesTo: couponAppliesToSchema,
  isActive: z.boolean(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export const saveCouponSchema = z
  .object({
    code: z
      .string()
      .trim()
      .min(2)
      .max(40)
      .transform((value) => value.toUpperCase()),
    name: z.string().trim().min(2).max(80),
    percentOff: z.number().int().min(1).max(100).nullable().optional(),
    amountOffCents: z.number().int().positive().nullable().optional(),
    maxRedemptions: z.number().int().positive().nullable().optional(),
    startsAt: z.string().datetime().nullable().optional(),
    endsAt: z.string().datetime().nullable().optional(),
    appliesTo: couponAppliesToSchema,
    isActive: z.boolean().default(true),
  })
  .refine((value) => Boolean(value.percentOff) !== Boolean(value.amountOffCents) || value.percentOff || value.amountOffCents, {
    message: 'Provide either percentOff or amountOffCents',
  })
  .refine((value) => !(value.percentOff && value.amountOffCents), {
    message: 'Use percentOff or amountOffCents, not both',
  });

export const validateCouponSchema = z.object({
  code: z.string().trim().min(2).max(40),
  channel: bookingPaymentChannelSchema,
  subtotalCents: z.number().int().nonnegative(),
});

export const validateCouponResultSchema = z.object({
  valid: z.boolean(),
  code: z.string().optional(),
  name: z.string().optional(),
  discountCents: z.number().int().nonnegative().optional(),
  error: z.string().optional(),
});

export const customerSnapshotSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().max(200),
  phone: z.string().trim().min(7).max(40),
  addressLine1: z.string().trim().min(3).max(200),
  addressLine2: z.string().trim().max(200).optional().nullable(),
  city: z.string().trim().min(2).max(100),
  state: z.string().trim().min(2).max(40),
  zip: z.string().trim().max(20).optional().default(''),
});

export const createQuoteRequestSchema = z.object({
  customer: customerSnapshotSchema,
  preferredDate: z.string().optional().nullable(),
  notes: z.string().trim().max(2000).optional().default(''),
  serviceId: z.string().min(1).max(60),
  estimateSnapshot: z.record(z.string(), z.unknown()),
  subtotalCents: z.number().int().nonnegative(),
  taxCents: z.number().int().nonnegative().default(0),
  amountCents: z.number().int().nonnegative(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const createPaypalOrderSchema = z.object({
  customer: customerSnapshotSchema,
  preferredDate: z.string().min(8).max(32),
  notes: z.string().trim().max(2000).optional().default(''),
  serviceId: z.string().min(1).max(60),
  estimateSnapshot: z.record(z.string(), z.unknown()),
  subtotalCents: z.number().int().positive(),
  taxCents: z.number().int().nonnegative().default(0),
  amountCents: z.number().int().positive(),
  couponCode: z.string().trim().max(40).optional().nullable(),
  idempotencyKey: z.string().trim().min(8).max(120),
});

export const capturePaypalOrderSchema = z.object({
  paypalOrderId: z.string().trim().min(5).max(80),
});

export const bookingPaymentOrderSchema = z.object({
  id: z.string(),
  reference: z.string(),
  channel: bookingPaymentChannelSchema,
  status: bookingPaymentStatusSchema,
  fullName: z.string(),
  email: z.string(),
  phone: z.string(),
  preferredDate: z.string().nullable(),
  notes: z.string(),
  serviceId: z.string(),
  subtotalCents: z.number().int(),
  discountCents: z.number().int(),
  taxCents: z.number().int(),
  amountCents: z.number().int(),
  couponCode: z.string().nullable(),
  paypalOrderId: z.string().nullable(),
  paymentMethod: z.string().nullable(),
  createdAt: z.string().datetime(),
  updatedAt: z.string().datetime(),
});

export type PublicPaymentConfig = z.infer<typeof publicPaymentConfigSchema>;
export type SavePaymentSettingsInput = z.infer<typeof savePaymentSettingsSchema>;
export type SaveCouponInput = z.infer<typeof saveCouponSchema>;
export type CreateQuoteRequestInput = z.infer<typeof createQuoteRequestSchema>;
export type CreatePaypalOrderInput = z.infer<typeof createPaypalOrderSchema>;
