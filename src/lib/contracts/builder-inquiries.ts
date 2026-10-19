// @polsia:user-owned — client-safe builder inquiry and budgetary estimate contracts.
import { z } from 'zod';

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

export const builderUnitTypeSchema = z.enum([
  'studio',
  'oneBedroom',
  'twoBedroom',
  'threeBedroom',
  'fourPlusBedroom',
]);
export const builderFurnishingStatusSchema = z.enum(['empty', 'furnished']);
export const builderConstructionStageSchema = z.enum([
  'rough_complete',
  'final_trades_in_progress',
  'substantially_complete',
  'ready_for_handover',
]);
export const builderSiteAccessSchema = z.enum([
  'open_access',
  'coordinated_access',
  'restricted_access',
]);
export const builderUtilityReadinessSchema = z.enum([
  'utilities_on',
  'utilities_partial',
  'utilities_not_on',
]);
export const builderCleaningScopeSchema = z.enum(['rough', 'final', 'punchList']);

export const BuilderUnitMixRow = z.object({
  unitType: builderUnitTypeSchema,
  count: z.number().int().positive().max(10000),
});

const unitMix = z
  .array(BuilderUnitMixRow)
  .min(1, 'Add at least one unit type')
  .max(10, 'Use up to 10 unit types')
  .superRefine((rows, context) => {
    const seen = new Set<string>();
    rows.forEach((row, index) => {
      if (seen.has(row.unitType)) {
        context.addIssue({
          code: 'custom',
          path: [index, 'unitType'],
          message: 'Choose each unit type once and adjust its count instead',
        });
      }
      seen.add(row.unitType);
    });
  });

const projectFields = {
  projectAddressLine1: z.string().trim().min(1, 'Project address is required').max(180),
  projectAddressLine2: z.string().trim().max(180).optional(),
  projectCity: z.string().trim().min(1, 'Project city is required').max(100),
  projectState: z.string().trim().min(2, 'Project state is required').max(80),
  projectZip: z.string().regex(/^\d{5}$/, 'Enter a 5-digit project ZIP code'),
  startingUnitCount: z.number().int().positive('Starting units must be positive').max(10000),
  totalPlannedUnitCount: z
    .number()
    .int()
    .positive('Total planned units must be positive')
    .max(10000),
  approximateSquareFootage: z
    .number()
    .int()
    .positive('Approximate square footage must be positive')
    .max(10000000),
  furnishingStatus: builderFurnishingStatusSchema,
  constructionStage: builderConstructionStageSchema,
  siteAccess: builderSiteAccessSchema,
  utilityReadiness: builderUtilityReadinessSchema,
  targetHandoverDate: calendarDate,
  preferredFinalCleanDate: calendarDate,
  isPhased: z.boolean(),
  isRecurring: z.boolean(),
  unitMix,
  cleaningScopes: z
    .array(builderCleaningScopeSchema)
    .min(1, 'Choose at least one cleaning scope')
    .max(3)
    .refine((values) => new Set(values).size === values.length, 'Choose each scope once'),
  remainingDebris: z.string().trim().min(1, 'Describe remaining debris or residue').max(2000),
  appliancesWindowsOther: z
    .string()
    .trim()
    .min(1, 'Describe appliances, windows, or other special scope')
    .max(2000),
  notes: z.string().trim().max(3000, 'Notes are too long').optional(),
};

export const BuilderEstimateRequest = z.object(projectFields).superRefine((value, context) => {
  if (value.totalPlannedUnitCount < value.startingUnitCount) {
    context.addIssue({
      code: 'custom',
      path: ['totalPlannedUnitCount'],
      message: 'Total planned units must be at least the starting unit count',
    });
  }
  const unitMixTotal = value.unitMix.reduce((total, row) => total + row.count, 0);
  if (unitMixTotal !== value.totalPlannedUnitCount) {
    context.addIssue({
      code: 'custom',
      path: ['unitMix'],
      message: 'Unit-mix counts must add up to total planned units',
    });
  }
});

export const BuilderInquirySubmission = z
  .object({
    companyName: z.string().trim().min(1, 'Company name is required').max(160),
    projectContactName: z.string().trim().min(1, 'Project contact is required').max(120),
    projectContactEmail: z.string().trim().email('Enter a valid project contact email'),
    projectContactPhone: z.string().trim().min(7, 'Enter a valid project contact phone').max(30),
    ...projectFields,
  })
  .superRefine((value, context) => {
    if (value.totalPlannedUnitCount < value.startingUnitCount) {
      context.addIssue({
        code: 'custom',
        path: ['totalPlannedUnitCount'],
        message: 'Total planned units must be at least the starting unit count',
      });
    }
    const unitMixTotal = value.unitMix.reduce((total, row) => total + row.count, 0);
    if (unitMixTotal !== value.totalPlannedUnitCount) {
      context.addIssue({
        code: 'custom',
        path: ['unitMix'],
        message: 'Unit-mix counts must add up to total planned units',
      });
    }
  });

export const BuilderBudgetaryEstimate = z.object({
  status: z.literal('budgetary'),
  areaClassification: z.enum(['core', 'nearby', 'extended']),
  volumeBand: z.enum(['1-4', '5-19', '20-49', '50+']),
  projectUnitCount: z.number().int().positive(),
  perUnitLowCents: z.number().int().positive(),
  perUnitHighCents: z.number().int().positive(),
  projectLowCents: z.number().int().positive(),
  projectHighCents: z.number().int().positive(),
  perUnitRange: z.string().min(1),
  projectRange: z.string().min(1),
  assumptions: z.array(z.string().min(1)).min(1),
  disclaimer: z.string().min(1),
});

export const BuilderEstimateResponse = BuilderBudgetaryEstimate;
export const BuilderInquiryResponse = z.object({
  inquiryReference: z.string().min(1),
  estimate: BuilderBudgetaryEstimate,
});

export type BuilderUnitMixRow = z.infer<typeof BuilderUnitMixRow>;
export type BuilderEstimateRequest = z.infer<typeof BuilderEstimateRequest>;
export type BuilderInquirySubmission = z.infer<typeof BuilderInquirySubmission>;
export type BuilderBudgetaryEstimate = z.infer<typeof BuilderBudgetaryEstimate>;
