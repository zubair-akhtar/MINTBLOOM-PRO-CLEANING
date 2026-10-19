// @polsia:user-owned — client island for typed builder/developer bid inquiries.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { LoaderCircle, Plus, Send, Trash2, Waypoints } from 'lucide-react';
import { useEffect, useState } from 'react';
import { useFieldArray, useForm, useWatch } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from '@/components/ui/form';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import {
  type BuilderBudgetaryEstimate,
  BuilderEstimateRequest,
  BuilderEstimateResponse,
  BuilderInquiryResponse,
  BuilderInquirySubmission,
  type BuilderInquirySubmission as BuilderInquiryValues,
} from '@/lib/contracts/builder-inquiries';
import { applyServerErrors } from '@/lib/forms';

const DEFAULT_VALUES: BuilderInquiryValues = {
  companyName: '',
  projectContactName: '',
  projectContactEmail: '',
  projectContactPhone: '',
  projectAddressLine1: '',
  projectAddressLine2: '',
  projectCity: 'Lubbock',
  projectState: 'TX',
  projectZip: '',
  startingUnitCount: 4,
  totalPlannedUnitCount: 4,
  approximateSquareFootage: 3200,
  furnishingStatus: 'empty',
  constructionStage: 'substantially_complete',
  siteAccess: 'coordinated_access',
  utilityReadiness: 'utilities_partial',
  targetHandoverDate: '',
  preferredFinalCleanDate: '',
  isPhased: false,
  isRecurring: false,
  unitMix: [{ unitType: 'oneBedroom', count: 4 }],
  cleaningScopes: ['final'],
  remainingDebris: '',
  appliancesWindowsOther: '',
  notes: '',
};

const UNIT_LABELS = {
  studio: 'Studio',
  oneBedroom: '1 bedroom',
  twoBedroom: '2 bedrooms',
  threeBedroom: '3 bedrooms',
  fourPlusBedroom: '4+ bedrooms',
} as const;
const STAGE_LABELS = {
  rough_complete: 'Rough construction complete',
  final_trades_in_progress: 'Final trades in progress',
  substantially_complete: 'Substantially complete',
  ready_for_handover: 'Ready for handover review',
} as const;
const ACCESS_LABELS = {
  open_access: 'Open access',
  coordinated_access: 'Coordinated access',
  restricted_access: 'Restricted access',
} as const;
const UTILITY_LABELS = {
  utilities_on: 'Utilities on',
  utilities_partial: 'Utilities partially on',
  utilities_not_on: 'Utilities not on yet',
} as const;
const SCOPE_LABELS = {
  rough: 'Earlier rough clean',
  final: 'Final clean',
  punchList: 'Post-inspection punch-list re-clean',
} as const;

export function BuilderInquiryForm() {
  const [estimate, setEstimate] = useState<BuilderBudgetaryEstimate | null>(null);
  const [estimateLoading, setEstimateLoading] = useState(false);
  const [estimateError, setEstimateError] = useState(false);
  const form = useForm<BuilderInquiryValues>({
    resolver: zodResolver(BuilderInquirySubmission),
    defaultValues: DEFAULT_VALUES,
  });
  const unitMixFields = useFieldArray({ control: form.control, name: 'unitMix' });
  const watched = useWatch({ control: form.control });

  useEffect(() => {
    const candidate = BuilderEstimateRequest.safeParse({
      projectAddressLine1: watched.projectAddressLine1,
      projectAddressLine2: watched.projectAddressLine2,
      projectCity: watched.projectCity,
      projectState: watched.projectState,
      projectZip: watched.projectZip,
      startingUnitCount: watched.startingUnitCount,
      totalPlannedUnitCount: watched.totalPlannedUnitCount,
      approximateSquareFootage: watched.approximateSquareFootage,
      furnishingStatus: watched.furnishingStatus,
      constructionStage: watched.constructionStage,
      siteAccess: watched.siteAccess,
      utilityReadiness: watched.utilityReadiness,
      targetHandoverDate: watched.targetHandoverDate,
      preferredFinalCleanDate: watched.preferredFinalCleanDate,
      isPhased: watched.isPhased,
      isRecurring: watched.isRecurring,
      unitMix: watched.unitMix,
      cleaningScopes: watched.cleaningScopes,
      remainingDebris: watched.remainingDebris,
      appliancesWindowsOther: watched.appliancesWindowsOther,
      notes: watched.notes,
    });
    if (!candidate.success) {
      setEstimate(null);
      setEstimateError(false);
      setEstimateLoading(false);
      return;
    }

    let active = true;
    setEstimateLoading(true);
    const timer = window.setTimeout(async () => {
      try {
        const result = await apiFetch('/api/builder-inquiries/estimate', {
          method: 'POST',
          body: JSON.stringify(candidate.data),
          schema: BuilderEstimateResponse,
        });
        if (active) {
          setEstimate(result);
          setEstimateError(false);
        }
      } catch {
        if (active) {
          setEstimate(null);
          setEstimateError(true);
        }
      } finally {
        if (active) setEstimateLoading(false);
      }
    }, 350);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [
    watched.projectAddressLine1,
    watched.projectAddressLine2,
    watched.projectCity,
    watched.projectState,
    watched.projectZip,
    watched.startingUnitCount,
    watched.totalPlannedUnitCount,
    watched.approximateSquareFootage,
    watched.furnishingStatus,
    watched.constructionStage,
    watched.siteAccess,
    watched.utilityReadiness,
    watched.targetHandoverDate,
    watched.preferredFinalCleanDate,
    watched.isPhased,
    watched.isRecurring,
    watched.unitMix,
    watched.cleaningScopes,
    watched.remainingDebris,
    watched.appliancesWindowsOther,
    watched.notes,
  ]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      const result = await apiFetch('/api/builder-inquiries', {
        method: 'POST',
        body: JSON.stringify(values),
        schema: BuilderInquiryResponse,
      });
      toast.success(
        `Inquiry ${result.inquiryReference} received · ${result.estimate.perUnitRange}. We will review the scope before confirming pricing.`,
      );
    } catch (error) {
      const cause = error instanceof Error ? error.cause : undefined;
      if (applyServerErrors(cause, form.setError)) return;
      toast.error('We could not send the project brief. Please try again.');
    }
  });

  return (
    <Card className="overflow-hidden border-primary/15 shadow-lg shadow-brand-900/5">
      <CardHeader className="border-b border-border bg-card/80 p-6 sm:p-8">
        <div className="flex items-center gap-2 text-eyebrow text-primary">
          <Waypoints className="size-4" aria-hidden /> Multi-unit project brief
        </div>
        <h1 className="mt-3 max-w-2xl font-display text-h2">
          Bring the whole handover plan into one review.
        </h1>
        <CardDescription className="max-w-3xl text-body">
          Share the project shape, timing, readiness, and cleaning scope. Mintbloom will return a
          server-calculated budgetary range per unit and for the planned project before a human
          scope review.
        </CardDescription>
      </CardHeader>
      <CardContent className="p-6 sm:p-8">
        <Form {...form}>
          <form onSubmit={onSubmit} className="flex flex-col gap-10" noValidate>
            <section className="grid gap-6 lg:grid-cols-2">
              <SectionIntro eyebrow="01 · Project contact" title="Who should we coordinate with?" />
              <div className="grid gap-5 sm:grid-cols-2">
                <TextField control={form.control} name="companyName" label="Company name" />
                <TextField
                  control={form.control}
                  name="projectContactName"
                  label="Project contact"
                />
                <TextField
                  control={form.control}
                  name="projectContactEmail"
                  label="Contact email"
                  type="email"
                />
                <TextField
                  control={form.control}
                  name="projectContactPhone"
                  label="Contact phone"
                  type="tel"
                />
              </div>
            </section>

            <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
              <SectionIntro
                eyebrow="02 · Project footprint"
                title="Where and how large is the work?"
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <div className="sm:col-span-2">
                  <TextField
                    control={form.control}
                    name="projectAddressLine1"
                    label="Project address"
                  />
                </div>
                <div className="sm:col-span-2">
                  <TextField
                    control={form.control}
                    name="projectAddressLine2"
                    label="Suite, building, or phase (optional)"
                  />
                </div>
                <TextField control={form.control} name="projectCity" label="City" />
                <TextField control={form.control} name="projectState" label="State" />
                <TextField
                  control={form.control}
                  name="projectZip"
                  label="ZIP code"
                  inputMode="numeric"
                />
                <NumberField
                  control={form.control}
                  name="startingUnitCount"
                  label="Units to start"
                />
                <NumberField
                  control={form.control}
                  name="totalPlannedUnitCount"
                  label="Total planned units"
                />
                <NumberField
                  control={form.control}
                  name="approximateSquareFootage"
                  label="Approx. total square footage"
                />
              </div>
            </section>

            <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
              <SectionIntro
                eyebrow="03 · Unit mix"
                title="Make the range reflect the actual homes."
                description="Unit-mix counts must add up to total planned units."
              />
              <div className="flex flex-col gap-3">
                {unitMixFields.fields.map((row, index) => (
                  <div key={row.id} className="grid gap-3 sm:grid-cols-[1fr_9rem_auto]">
                    <FormField
                      control={form.control}
                      name={`unitMix.${index}.unitType`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Unit type {index + 1}</FormLabel>
                          <Select value={field.value} onValueChange={field.onChange}>
                            <FormControl>
                              <SelectTrigger>
                                <SelectValue placeholder="Unit type" />
                              </SelectTrigger>
                            </FormControl>
                            <SelectContent>
                              {Object.entries(UNIT_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <FormField
                      control={form.control}
                      name={`unitMix.${index}.count`}
                      render={({ field }) => (
                        <FormItem>
                          <FormLabel className="sr-only">Unit count {index + 1}</FormLabel>
                          <FormControl>
                            <Input
                              type="number"
                              min={1}
                              {...field}
                              onChange={(event) => field.onChange(Number(event.target.value))}
                              aria-label={`Count for unit type ${index + 1}`}
                            />
                          </FormControl>
                          <FormMessage />
                        </FormItem>
                      )}
                    />
                    <Button
                      type="button"
                      variant="ghost"
                      size="icon"
                      aria-label={`Remove unit type ${index + 1}`}
                      disabled={unitMixFields.fields.length === 1}
                      onClick={() => unitMixFields.remove(index)}
                    >
                      <Trash2 className="size-4" aria-hidden />
                    </Button>
                  </div>
                ))}
                <Button
                  type="button"
                  variant="outline"
                  className="mt-2 w-fit gap-2"
                  onClick={() => unitMixFields.append({ unitType: 'studio', count: 1 })}
                >
                  <Plus className="size-4" aria-hidden /> Add unit type
                </Button>
                <FormField
                  control={form.control}
                  name="unitMix"
                  render={() => (
                    <FormItem>
                      <FormMessage />
                    </FormItem>
                  )}
                />
              </div>
            </section>

            <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
              <SectionIntro
                eyebrow="04 · Readiness"
                title="Dates are conditional on the site being ready."
              />
              <div className="grid gap-5 sm:grid-cols-2">
                <SelectField
                  control={form.control}
                  name="furnishingStatus"
                  label="Furnishing status"
                  options={{ empty: 'Empty', furnished: 'Furnished' }}
                />
                <SelectField
                  control={form.control}
                  name="constructionStage"
                  label="Construction stage"
                  options={STAGE_LABELS}
                />
                <SelectField
                  control={form.control}
                  name="siteAccess"
                  label="Site access"
                  options={ACCESS_LABELS}
                />
                <SelectField
                  control={form.control}
                  name="utilityReadiness"
                  label="Utilities / readiness"
                  options={UTILITY_LABELS}
                />
                <TextField
                  control={form.control}
                  name="targetHandoverDate"
                  label="Target handover / client move-in"
                  type="date"
                />
                <TextField
                  control={form.control}
                  name="preferredFinalCleanDate"
                  label="Preferred final-clean date"
                  type="date"
                />
                <div className="sm:col-span-2 rounded-xl border border-primary/20 bg-primary/5 p-4 text-small text-muted-foreground">
                  A final clean can usually land 24–48 hours before handover only after major
                  construction and trades are finished, utilities are on, and heavy debris is out.
                  Use rough clean for an earlier pass and punch-list for post-inspection re-clean.
                </div>
              </div>
            </section>

            <section className="grid gap-6 border-t border-border pt-8 lg:grid-cols-2">
              <SectionIntro eyebrow="05 · Scope" title="What should the crew plan for?" />
              <div className="flex flex-col gap-5">
                <FormField
                  control={form.control}
                  name="cleaningScopes"
                  render={({ field }) => (
                    <FormItem>
                      <FormLabel>Cleaning scopes</FormLabel>
                      <FormDescription>Choose every phase you may need.</FormDescription>
                      <div className="mt-3 grid gap-3">
                        {Object.entries(SCOPE_LABELS).map(([value, label]) => (
                          <label
                            key={value}
                            htmlFor={`builder-scope-${value}`}
                            className="flex cursor-pointer items-start gap-3 rounded-xl border border-border p-4 transition-colors hover:border-primary/60 has-[[data-state=checked]]:border-primary has-[[data-state=checked]]:bg-primary/5"
                          >
                            <Checkbox
                              id={`builder-scope-${value}`}
                              checked={field.value.includes(
                                value as BuilderInquiryValues['cleaningScopes'][number],
                              )}
                              onCheckedChange={(checked) => {
                                const scope =
                                  value as BuilderInquiryValues['cleaningScopes'][number];
                                field.onChange(
                                  checked
                                    ? [...field.value, scope]
                                    : field.value.filter((selected) => selected !== scope),
                                );
                              }}
                              className="mt-0.5"
                            />
                            <span className="text-small font-semibold">{label}</span>
                          </label>
                        ))}
                      </div>
                      <FormMessage />
                    </FormItem>
                  )}
                />
                <TextAreaField
                  control={form.control}
                  name="remainingDebris"
                  label="Remaining debris or construction residue"
                  placeholder="Drywall dust, adhesive, grout haze, packaging, light debris, or none…"
                />
                <TextAreaField
                  control={form.control}
                  name="appliancesWindowsOther"
                  label="Appliances, windows, or other special scope"
                  placeholder="Interior windows, appliance interiors, cabinets, fixtures, or other details…"
                />
                <TextAreaField
                  control={form.control}
                  name="notes"
                  label="Additional project notes (optional)"
                  placeholder="Access windows, phasing notes, recurring turnover cadence, or questions…"
                />
                <div className="grid gap-3 sm:grid-cols-2">
                  <BooleanField control={form.control} name="isPhased" label="Work is phased" />
                  <BooleanField control={form.control} name="isRecurring" label="Work may recur" />
                </div>
              </div>
            </section>

            <EstimateCard estimate={estimate} loading={estimateLoading} error={estimateError} />

            <Button
              type="submit"
              size="lg"
              className="w-full gap-2 shadow-brand"
              disabled={form.formState.isSubmitting}
            >
              <Send className="size-4" aria-hidden />
              {form.formState.isSubmitting
                ? 'Sending project brief…'
                : 'Send project brief for review'}
            </Button>
            <p className="text-center text-caption text-muted-foreground">
              No checkout is created. This range is budgetary and non-binding until Mintbloom
              reviews the scope or completes a site walkthrough.
            </p>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}

function SectionIntro({
  eyebrow,
  title,
  description,
}: {
  eyebrow: string;
  title: string;
  description?: string;
}) {
  return (
    <div className="flex flex-col gap-2">
      <p className="text-eyebrow text-primary">{eyebrow}</p>
      <h2 className="font-display text-h3">{title}</h2>
      {description && <p className="text-small text-muted-foreground">{description}</p>}
    </div>
  );
}

function TextField({
  control,
  name,
  label,
  type = 'text',
  inputMode,
}: {
  control: ReturnType<typeof useForm<BuilderInquiryValues>>['control'];
  name:
    | 'companyName'
    | 'projectContactName'
    | 'projectContactEmail'
    | 'projectContactPhone'
    | 'projectAddressLine1'
    | 'projectAddressLine2'
    | 'projectCity'
    | 'projectState'
    | 'projectZip'
    | 'targetHandoverDate'
    | 'preferredFinalCleanDate';
  label: string;
  type?: string;
  inputMode?: 'numeric';
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input type={type} inputMode={inputMode} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function NumberField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<BuilderInquiryValues>>['control'];
  name: 'startingUnitCount' | 'totalPlannedUnitCount' | 'approximateSquareFootage';
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Input
              type="number"
              min={1}
              {...field}
              onChange={(event) => field.onChange(Number(event.target.value))}
            />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function SelectField({
  control,
  name,
  label,
  options,
}: {
  control: ReturnType<typeof useForm<BuilderInquiryValues>>['control'];
  name: 'furnishingStatus' | 'constructionStage' | 'siteAccess' | 'utilityReadiness';
  label: string;
  options: Record<string, string>;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <Select value={field.value} onValueChange={field.onChange}>
            <FormControl>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
            </FormControl>
            <SelectContent>
              {Object.entries(options).map(([value, optionLabel]) => (
                <SelectItem key={value} value={value}>
                  {optionLabel}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function TextAreaField({
  control,
  name,
  label,
  placeholder,
}: {
  control: ReturnType<typeof useForm<BuilderInquiryValues>>['control'];
  name: 'remainingDebris' | 'appliancesWindowsOther' | 'notes';
  label: string;
  placeholder: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem>
          <FormLabel>{label}</FormLabel>
          <FormControl>
            <Textarea placeholder={placeholder} {...field} />
          </FormControl>
          <FormMessage />
        </FormItem>
      )}
    />
  );
}

function BooleanField({
  control,
  name,
  label,
}: {
  control: ReturnType<typeof useForm<BuilderInquiryValues>>['control'];
  name: 'isPhased' | 'isRecurring';
  label: string;
}) {
  return (
    <FormField
      control={control}
      name={name}
      render={({ field }) => (
        <FormItem className="flex items-center gap-3 rounded-xl border border-border p-4">
          <FormControl>
            <Checkbox checked={field.value} onCheckedChange={field.onChange} />
          </FormControl>
          <FormLabel className="cursor-pointer">{label}</FormLabel>
        </FormItem>
      )}
    />
  );
}

function EstimateCard({
  estimate,
  loading,
  error,
}: {
  estimate: BuilderBudgetaryEstimate | null;
  loading: boolean;
  error: boolean;
}) {
  return (
    <div className="rounded-2xl border border-primary/25 bg-primary/5 p-5 sm:p-6">
      <div className="flex items-start justify-between gap-4">
        <div>
          <p className="text-eyebrow text-primary">Budgetary signal</p>
          <h2 className="mt-1 font-display text-h3">A range you can plan around.</h2>
          <p className="mt-2 max-w-2xl text-small text-muted-foreground">
            The estimate updates from the project inputs above. It uses unit mix, scope, size,
            furnishing status, service area, and volume — not a browser-supplied price.
          </p>
        </div>
        {loading && (
          <LoaderCircle
            className="size-5 animate-spin text-primary"
            aria-label="Updating estimate"
          />
        )}
      </div>
      {error && (
        <p className="mt-4 text-small text-destructive">
          We could not update the estimate. Try again.
        </p>
      )}
      {!loading && !error && !estimate && (
        <p className="mt-4 text-small text-muted-foreground">
          Complete the project address, unit mix, readiness, dates, and scope to see the range.
        </p>
      )}
      {estimate && (
        <div className="mt-6 grid gap-5 sm:grid-cols-2">
          <div className="rounded-xl border border-primary/15 bg-background/70 p-4">
            <p className="text-caption text-muted-foreground">Budgetary range per unit</p>
            <p className="mt-1 font-display text-h3 text-primary">{estimate.perUnitRange}</p>
          </div>
          <div className="rounded-xl border border-primary/15 bg-background/70 p-4">
            <p className="text-caption text-muted-foreground">
              Planned project range · {estimate.projectUnitCount} units
            </p>
            <p className="mt-1 font-display text-h3 text-primary">{estimate.projectRange}</p>
          </div>
          <div className="sm:col-span-2">
            <p className="text-small font-semibold text-foreground">
              {estimate.volumeBand} volume band · {estimate.areaClassification} service area
            </p>
            <ul className="mt-2 grid gap-1 text-caption text-muted-foreground sm:grid-cols-2">
              {estimate.assumptions.map((assumption) => (
                <li key={assumption}>• {assumption}</li>
              ))}
            </ul>
            <p className="mt-4 text-small font-medium text-foreground">{estimate.disclaimer}</p>
          </div>
        </div>
      )}
    </div>
  );
}
