// @polsia:user-owned — server-only builder estimate calculation and persistence.
import 'server-only';

import { classifyBookingArea } from '@/lib/business/bookings';
import {
  type BuilderBudgetaryEstimate,
  type BuilderEstimateRequest,
  BuilderEstimateRequest as BuilderEstimateRequestSchema,
  type BuilderInquirySubmission,
  BuilderInquirySubmission as BuilderInquirySubmissionSchema,
} from '@/lib/contracts/builder-inquiries';
import { prisma } from '@/lib/db';
import { sendEmail } from '@/lib/email/send';
import { builderInquiryNotificationEmail } from '@/lib/email/templates';
import { env } from '@/lib/env';

type UnitType = BuilderEstimateRequest['unitMix'][number]['unitType'];
type VolumeBand = BuilderBudgetaryEstimate['volumeBand'];

const UNIT_RANGES_CENTS: Record<UnitType, { low: number; high: number }> = {
  studio: { low: 14500, high: 19500 },
  oneBedroom: { low: 17500, high: 23000 },
  twoBedroom: { low: 21500, high: 28500 },
  threeBedroom: { low: 26500, high: 34500 },
  fourPlusBedroom: { low: 33000, high: 44000 },
};

const SCOPE_MULTIPLIERS: Record<BuilderEstimateRequest['cleaningScopes'][number], number> = {
  rough: 0.68,
  final: 1,
  punchList: 0.5,
};

const VOLUME_BANDS: Record<VolumeBand, { max: number | null; multiplier: number; label: string }> =
  {
    '1-4': { max: 4, multiplier: 1, label: '1–4 units' },
    '5-19': { max: 19, multiplier: 0.93, label: '5–19 units' },
    '20-49': { max: 49, multiplier: 0.86, label: '20–49 units' },
    '50+': { max: null, multiplier: 0.8, label: '50+ units' },
  };

const AREA_MULTIPLIERS = { core: 1, nearby: 1.1, extended: 1.25 } as const;

function formatAmount(amountCents: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(
    amountCents / 100,
  );
}

function volumeBandFor(unitCount: number): VolumeBand {
  if (unitCount <= 4) return '1-4';
  if (unitCount <= 19) return '5-19';
  if (unitCount <= 49) return '20-49';
  return '50+';
}

function sizeMultiplierFor(squareFootagePerUnit: number): number {
  if (squareFootagePerUnit < 700) return 0.9;
  if (squareFootagePerUnit <= 1200) return 1;
  if (squareFootagePerUnit <= 1800) return 1.12;
  return 1.25;
}

function furnishingMultiplierFor(status: BuilderEstimateRequest['furnishingStatus']): number {
  return status === 'furnished' ? 1.2 : 1;
}

function weightedUnitRange(input: BuilderEstimateRequest) {
  const totalUnits = input.unitMix.reduce((total, row) => total + row.count, 0);
  return input.unitMix.reduce(
    (range, row) => {
      const unitRange = UNIT_RANGES_CENTS[row.unitType];
      const weight = row.count / totalUnits;
      return {
        low: range.low + unitRange.low * weight,
        high: range.high + unitRange.high * weight,
      };
    },
    { low: 0, high: 0 },
  );
}

function scopeMultiplierFor(input: BuilderEstimateRequest): number {
  return input.cleaningScopes.reduce((total, scope) => total + SCOPE_MULTIPLIERS[scope], 0);
}

function dateToUtc(date: string): Date {
  return new Date(`${date}T00:00:00.000Z`);
}

function assumptionsFor(
  input: BuilderEstimateRequest,
  areaClassification: BuilderBudgetaryEstimate['areaClassification'],
  volumeBand: VolumeBand,
  squareFootagePerUnit: number,
): string[] {
  const travelNote =
    areaClassification === 'core'
      ? 'Core Lubbock travel is included in the budgetary factors.'
      : areaClassification === 'nearby'
        ? 'Nearby-area travel is reflected with a modest travel factor.'
        : 'Extended-area travel is reflected with a larger travel factor and may need separate review.';
  return [
    `Weighted unit mix across ${volumeBand}.`,
    `${Math.round(squareFootagePerUnit).toLocaleString('en-US')} approximate square feet per unit; ${input.furnishingStatus} condition factor applied.`,
    `Selected scope: ${input.cleaningScopes.join(', ')}; ${VOLUME_BANDS[volumeBand].label} volume factor applied.`,
    travelNote,
    input.isPhased
      ? 'Phased delivery is noted; phase sequencing and mobilization will be reviewed.'
      : 'Estimate assumes one coordinated project sequence unless scope review changes it.',
  ];
}

export function calculateBuilderEstimate(input: BuilderEstimateRequest): BuilderBudgetaryEstimate {
  const parsed = BuilderEstimateRequestSchema.parse(input);
  const areaClassification = classifyBookingArea({
    zip: parsed.projectZip,
    state: parsed.projectState,
  });
  const volumeBand = volumeBandFor(parsed.totalPlannedUnitCount);
  const volumeMultiplier = VOLUME_BANDS[volumeBand].multiplier;
  const squareFootagePerUnit = parsed.approximateSquareFootage / parsed.totalPlannedUnitCount;
  const base = weightedUnitRange(parsed);
  const multiplier =
    scopeMultiplierFor(parsed) *
    sizeMultiplierFor(squareFootagePerUnit) *
    furnishingMultiplierFor(parsed.furnishingStatus) *
    AREA_MULTIPLIERS[areaClassification] *
    volumeMultiplier;
  const perUnitLowCents = Math.max(1, Math.round(base.low * multiplier));
  const perUnitHighCents = Math.max(perUnitLowCents, Math.round(base.high * multiplier));
  const projectLowCents = perUnitLowCents * parsed.totalPlannedUnitCount;
  const projectHighCents = perUnitHighCents * parsed.totalPlannedUnitCount;

  return {
    status: 'budgetary',
    areaClassification,
    volumeBand,
    projectUnitCount: parsed.totalPlannedUnitCount,
    perUnitLowCents,
    perUnitHighCents,
    projectLowCents,
    projectHighCents,
    perUnitRange: `${formatAmount(perUnitLowCents)}–${formatAmount(perUnitHighCents)} / unit`,
    projectRange: `${formatAmount(projectLowCents)}–${formatAmount(projectHighCents)} total`,
    assumptions: assumptionsFor(parsed, areaClassification, volumeBand, squareFootagePerUnit),
    disclaimer:
      'Budgetary and non-binding. Final pricing is confirmed after scope review or a site walkthrough; it is not a checkout price.',
  };
}

export async function createBuilderInquiry(input: BuilderInquirySubmission) {
  const parsed = BuilderInquirySubmissionSchema.parse(input);
  const estimate = calculateBuilderEstimate(parsed);
  const inquiry = await prisma.builderInquiry.create({
    data: {
      companyName: parsed.companyName,
      projectContactName: parsed.projectContactName,
      projectContactEmail: parsed.projectContactEmail,
      projectContactPhone: parsed.projectContactPhone,
      projectAddressLine1: parsed.projectAddressLine1,
      projectAddressLine2: parsed.projectAddressLine2 || null,
      projectCity: parsed.projectCity,
      projectState: parsed.projectState,
      projectZip: parsed.projectZip,
      startingUnitCount: parsed.startingUnitCount,
      totalPlannedUnitCount: parsed.totalPlannedUnitCount,
      approximateSquareFootage: parsed.approximateSquareFootage,
      furnishingStatus: parsed.furnishingStatus,
      constructionStage: parsed.constructionStage,
      siteAccess: parsed.siteAccess,
      utilityReadiness: parsed.utilityReadiness,
      targetHandoverDate: dateToUtc(parsed.targetHandoverDate),
      preferredFinalCleanDate: dateToUtc(parsed.preferredFinalCleanDate),
      isPhased: parsed.isPhased,
      isRecurring: parsed.isRecurring,
      notes: parsed.notes || null,
      unitMixSnapshot: parsed.unitMix,
      cleaningScopesSnapshot: parsed.cleaningScopes,
      residueSnapshot: parsed.remainingDebris,
      specialScopeSnapshot: parsed.appliancesWindowsOther,
      budgetaryEstimateSnapshot: estimate,
    },
  });

  const notification = builderInquiryNotificationEmail({
    inquiryReference: inquiry.id,
    input: parsed,
    estimate,
  });
  try {
    if (!env.POLSIA_COMPANY_EMAIL) return { inquiryReference: inquiry.id, estimate };
    await sendEmail({
      to: env.POLSIA_COMPANY_EMAIL,
      subject: notification.subject,
      html: notification.html,
      text: notification.text,
    });
  } catch {
    // Persistence is the source of truth; an email-proxy failure must not lose the inquiry.
  }

  return { inquiryReference: inquiry.id, estimate };
}
