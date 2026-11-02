// @polsia:user-owned — coupon validation and CRUD helpers.
import 'server-only';

import type { Coupon } from '@prisma/client';
import { prisma } from '@/lib/db';
import type { SaveCouponInput } from '@/lib/contracts/payments';

export function serializeCoupon(coupon: Coupon) {
  return {
    id: coupon.id,
    code: coupon.code,
    name: coupon.name,
    percentOff: coupon.percentOff,
    amountOffCents: coupon.amountOffCents,
    maxRedemptions: coupon.maxRedemptions,
    redemptionCount: coupon.redemptionCount,
    startsAt: coupon.startsAt?.toISOString() ?? null,
    endsAt: coupon.endsAt?.toISOString() ?? null,
    appliesTo: coupon.appliesTo,
    isActive: coupon.isActive,
    createdAt: coupon.createdAt.toISOString(),
    updatedAt: coupon.updatedAt.toISOString(),
  };
}

export function computeCouponDiscount(coupon: Coupon, subtotalCents: number) {
  if (coupon.percentOff && coupon.percentOff > 0) {
    return Math.min(subtotalCents, Math.round((subtotalCents * coupon.percentOff) / 100));
  }
  if (coupon.amountOffCents && coupon.amountOffCents > 0) {
    return Math.min(subtotalCents, coupon.amountOffCents);
  }
  return 0;
}

export async function findValidCoupon(code: string, channel: 'quote' | 'online', subtotalCents: number) {
  const normalized = code.trim().toUpperCase();
  const coupon = await prisma.coupon.findUnique({ where: { code: normalized } });
  if (!coupon || !coupon.isActive) return { valid: false as const, error: 'Invalid coupon code.' };
  const now = new Date();
  if (coupon.startsAt && coupon.startsAt > now)
    return { valid: false as const, error: 'This coupon is not active yet.' };
  if (coupon.endsAt && coupon.endsAt < now)
    return { valid: false as const, error: 'This coupon has expired.' };
  if (coupon.maxRedemptions != null && coupon.redemptionCount >= coupon.maxRedemptions)
    return { valid: false as const, error: 'This coupon has reached its usage limit.' };
  if (coupon.appliesTo === 'online_only' && channel !== 'online')
    return { valid: false as const, error: 'This coupon applies to online payments only.' };
  const discountCents = computeCouponDiscount(coupon, subtotalCents);
  if (discountCents <= 0) return { valid: false as const, error: 'Coupon does not apply to this total.' };
  return {
    valid: true as const,
    coupon,
    code: coupon.code,
    name: coupon.name,
    discountCents,
  };
}

export async function listCoupons() {
  const rows = await prisma.coupon.findMany({ orderBy: { createdAt: 'desc' } });
  return rows.map(serializeCoupon);
}

export async function createCoupon(input: SaveCouponInput) {
  const row = await prisma.coupon.create({
    data: {
      code: input.code,
      name: input.name,
      percentOff: input.percentOff ?? null,
      amountOffCents: input.amountOffCents ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      appliesTo: input.appliesTo,
      isActive: input.isActive,
    },
  });
  return serializeCoupon(row);
}

export async function updateCoupon(id: string, input: SaveCouponInput) {
  const row = await prisma.coupon.update({
    where: { id },
    data: {
      code: input.code,
      name: input.name,
      percentOff: input.percentOff ?? null,
      amountOffCents: input.amountOffCents ?? null,
      maxRedemptions: input.maxRedemptions ?? null,
      startsAt: input.startsAt ? new Date(input.startsAt) : null,
      endsAt: input.endsAt ? new Date(input.endsAt) : null,
      appliesTo: input.appliesTo,
      isActive: input.isActive,
    },
  });
  return serializeCoupon(row);
}

export async function deleteCoupon(id: string) {
  await prisma.coupon.delete({ where: { id } });
}
