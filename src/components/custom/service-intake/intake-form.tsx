// @polsia:user-owned — Customize this screen for your business.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import type { ReactNode } from 'react';
import { useEffect, useId, useRef, useState } from 'react';
import { Controller, useForm, useWatch } from 'react-hook-form';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';
import { applyServerErrors } from '@/lib/forms';
import {
  type Answers,
  answersSchema,
  type FormDefinition,
  type IntakeField,
  type Submission,
  submissionResponseSchema,
} from '@/modules/service-intake/contracts';

function displayAnswer(field: IntakeField, value: Answers[string] | undefined) {
  const label = (answer: string) =>
    field.options?.find((option) => option.value === answer)?.label ?? answer;
  if (Array.isArray(value)) return value.map(label).join(', ') || 'Not provided';
  return value === undefined || value === '' ? 'Not provided' : label(String(value));
}

type FieldValueChange = (fieldId: string, value: Answers[string] | undefined) => void;

export function IntakeForm({
  forms,
  initialFormId,
  initialAnswers,
  confirmationActions,
  onFieldValueChange,
}: {
  forms: FormDefinition[];
  initialFormId?: string;
  initialAnswers?: Partial<Answers>;
  confirmationActions?: ReactNode;
  onFieldValueChange?: FieldValueChange;
}) {
  const [selected, setSelected] = useState(
    initialFormId ?? (forms.length === 1 ? forms[0]?.id : ''),
  );
  const [generation, setGeneration] = useState(0);
  const definition = forms.find((form) => form.id === selected);
  if (!definition)
    return (
      <section className="space-y-6">
        <h1 className="text-3xl font-semibold tracking-tight">Request a service</h1>
        <p className="text-muted-foreground">Choose the service you need to get started.</p>
        <div className="grid gap-4 sm:grid-cols-2">
          {forms.map((form) => (
            <button
              key={form.id}
              type="button"
              onClick={() => setSelected(form.id)}
              className="rounded-lg border bg-card p-6 text-left transition-colors hover:bg-accent focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            >
              <span className="block text-xl font-medium">{form.title}</span>
              <span className="mt-2 block text-sm text-muted-foreground">{form.description}</span>
            </button>
          ))}
        </div>
      </section>
    );
  return (
    <Wizard
      key={`${definition.id}-${generation}`}
      definition={definition}
      onChoose={forms.length > 1 ? () => setSelected('') : undefined}
      onNew={() => setGeneration((value) => value + 1)}
      initialAnswers={initialAnswers}
      confirmationActions={confirmationActions}
      onFieldValueChange={onFieldValueChange}
    />
  );
}

function Wizard({
  definition,
  onChoose,
  onNew,
  initialAnswers,
  confirmationActions,
  onFieldValueChange,
}: {
  definition: FormDefinition;
  onChoose?: () => void;
  onNew: () => void;
  initialAnswers?: Partial<Answers>;
  confirmationActions?: ReactNode;
  onFieldValueChange?: FieldValueChange;
}) {
  const form = useForm<Answers>({
    resolver: zodResolver(answersSchema(definition)),
    defaultValues: initialAnswers,
    shouldUnregister: false,
  });
  const [step, setStep] = useState(0);
  const [busy, setBusy] = useState(false);
  const [uncertain, setUncertain] = useState(false);
  const [conflict, setConflict] = useState(false);
  const [error, setError] = useState('');
  const [reference, setReference] = useState('');
  const [focusField, setFocusField] = useState('');
  const payload = useRef<Submission | null>(null);
  const sending = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  const formElement = useRef<HTMLFormElement>(null);
  const alert = useRef<HTMLParagraphElement>(null);
  const prefix = useId();
  const serviceType = useWatch({ control: form.control, name: 'service_type' });
  const reviewing = step === definition.steps.length;
  const locked = busy || uncertain || conflict;
  const current = definition.steps[step];
  useEffect(() => {
    onFieldValueChange?.('service_type', serviceType);
  }, [onFieldValueChange, serviceType]);
  // biome-ignore lint/correctness/useExhaustiveDependencies: Moving between steps must focus the newly rendered heading.
  useEffect(() => {
    if (busy) return;
    if (focusField)
      formElement.current?.querySelector<HTMLElement>(`[name="${focusField}"]`)?.focus();
    else if (error) alert.current?.focus();
    else heading.current?.focus();
  }, [step, focusField, busy, error]);
  useEffect(() => {
    if (reference) heading.current?.focus();
  }, [reference]);

  async function send(values: Answers) {
    if (sending.current || conflict) return;
    sending.current = true;
    setBusy(true);
    setError('');
    setFocusField('');
    // Keep this exact envelope until the server establishes a definite outcome.
    payload.current ??= {
      formId: definition.id,
      formVersion: definition.version,
      attemptId: crypto.randomUUID(),
      answers: structuredClone(values),
    };
    try {
      const result = await apiFetch('/api/service-intake', {
        method: 'POST',
        body: JSON.stringify(payload.current),
        schema: submissionResponseSchema,
      });
      setReference(result.reference);
      setUncertain(false);
    } catch (failure) {
      if (failure instanceof Error && failure.message.endsWith('(400)')) {
        payload.current = null;
        setUncertain(false);
        const fieldErrors: string[] = [];
        applyServerErrors(failure.cause, (name, issue) => {
          form.setError(name, issue);
          fieldErrors.push(name);
        });
        const first = definition.steps
          .flatMap((item) => item.fields)
          .find((field) => fieldErrors.includes(field.id));
        if (first) {
          setStep(
            definition.steps.findIndex((item) =>
              item.fields.some((field) => field.id === first.id),
            ),
          );
          setFocusField(first.id);
        }
        setError(
          'Please check the highlighted fields. Your answers have been kept. If no field is highlighted, the form may have changed; reload before trying again.',
        );
      } else if (failure instanceof Error && failure.message.endsWith('(403)')) {
        setUncertain(true);
        setError(
          'The server blocked this submission. Your answers have been kept. Keep this page open and retry once access is restored.',
        );
      } else if (failure instanceof Error && failure.message.endsWith('(413)')) {
        payload.current = null;
        setUncertain(false);
        setError(
          'This request is too large. Shorten your descriptions and send it again. Your answers have been kept.',
        );
      } else if (failure instanceof Error && failure.message.endsWith('(409)')) {
        setConflict(true);
        setError(
          'This request conflicts with an earlier attempt. Reload the page to load the current form before starting again.',
        );
      } else {
        setUncertain(true);
        setError(
          failure instanceof Error && failure.message.endsWith('(429)')
            ? 'Too many requests have been sent. Keep this page open, wait up to 15 minutes, then retry the original request. Your answers are kept unchanged.'
            : 'We could not confirm whether your request was received. Keep this page open and retry the original request. Your answers are locked so the retry cannot create a different request.',
        );
      }
    } finally {
      sending.current = false;
      setBusy(false);
    }
  }

  async function advance() {
    if (!current) return;
    if (
      await form.trigger(
        current.fields.map((field) => field.id),
        { shouldFocus: true },
      )
    ) {
      setFocusField('');
      setStep((value) => value + 1);
    }
  }

  if (reference)
    return (
      <section className="space-y-6">
        <h1 ref={heading} tabIndex={-1} className="text-3xl font-semibold tracking-tight">
          Request received
        </h1>
        <p className="text-muted-foreground">{definition.confirmation}</p>
        <div className="rounded-lg border p-5">
          <p className="text-sm text-muted-foreground">Your reference</p>
          <p className="mt-1 break-all text-2xl font-semibold">{reference}</p>
          <p className="mt-2 text-sm text-muted-foreground">
            Keep this reference for your records.
          </p>
        </div>
        <Button type="button" onClick={onNew}>
          Start a new request
        </Button>
        {confirmationActions}
      </section>
    );

  return (
    <section className="space-y-8">
      <header className="space-y-3">
        <h1 className="text-3xl font-semibold tracking-tight">{definition.title}</h1>
        <p className="max-w-prose text-muted-foreground">{definition.description}</p>
        <p className="text-sm text-muted-foreground" aria-live="polite">
          Step {step + 1} of {definition.steps.length + 1}
        </p>
      </header>
      <form
        ref={formElement}
        noValidate
        className="space-y-6"
        onSubmit={(event) => {
          event.preventDefault();
          if (locked) return;
          if (reviewing)
            void form.handleSubmit(send, (errors) => {
              const first = definition.steps
                .flatMap((item) => item.fields)
                .find((field) => errors[field.id]);
              if (first) {
                setStep(
                  definition.steps.findIndex((item) =>
                    item.fields.some((field) => field.id === first.id),
                  ),
                );
                setFocusField(first.id);
              }
            })(event);
          else void advance();
        }}
      >
        <h2 ref={heading} tabIndex={-1} className="text-xl font-semibold">
          {reviewing ? 'Review your request' : current?.title}
        </h2>
        {error && (
          <p
            ref={alert}
            tabIndex={-1}
            role="alert"
            className="rounded-md border border-destructive p-4 text-sm text-destructive"
          >
            {error}
          </p>
        )}
        {reviewing ? (
          <div className="space-y-6">
            {definition.steps.map((item, index) => (
              <section key={item.id} className="space-y-3 border-b pb-5">
                <div className="flex items-center justify-between gap-3">
                  <h3 className="font-medium">{item.title}</h3>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={locked}
                    onClick={() => {
                      setFocusField('');
                      setStep(index);
                    }}
                  >
                    Edit {item.title}
                  </Button>
                </div>
                <dl className="space-y-3">
                  {item.fields.map((field) => (
                    <div key={field.id} className="grid gap-1 sm:grid-cols-2">
                      <dt className="text-sm text-muted-foreground">{field.label}</dt>
                      <dd className="whitespace-pre-wrap break-words text-sm">
                        {displayAnswer(field, form.getValues(field.id))}
                      </dd>
                    </div>
                  ))}
                </dl>
              </section>
            ))}
          </div>
        ) : (
          <fieldset disabled={locked} className="space-y-6">
            {current?.fields.map((field) => {
              const id = `${prefix}-${field.id}`;
              const issue = form.formState.errors[field.id];
              const shared = {
                id,
                'aria-invalid': !!issue,
                'aria-describedby': `${id}-help ${id}-error`,
              };
              return (
                <div key={field.id} className="space-y-2">
                  <Label htmlFor={id}>
                    {field.label}
                    {field.required ? ' (required)' : ' (optional)'}
                  </Label>
                  {field.type === 'multiple' ? (
                    <Controller
                      control={form.control}
                      name={field.id}
                      defaultValue={[]}
                      render={({ field: control }) => (
                        <fieldset {...shared} className="space-y-2">
                          <legend className="sr-only">{field.label}</legend>
                          {field.options?.map((option, index) => (
                            <label key={option.value} className="flex items-center gap-3 text-sm">
                              <input
                                ref={index === 0 ? control.ref : undefined}
                                type="checkbox"
                                name={control.name}
                                value={option.value}
                                checked={
                                  Array.isArray(control.value) &&
                                  control.value.includes(option.value)
                                }
                                onBlur={control.onBlur}
                                onChange={(event) => {
                                  const values = Array.isArray(control.value) ? control.value : [];
                                  control.onChange(
                                    event.target.checked
                                      ? [...values, option.value]
                                      : values.filter((value) => value !== option.value),
                                  );
                                }}
                                className="size-4 accent-primary"
                              />
                              {option.label}
                            </label>
                          ))}
                        </fieldset>
                      )}
                    />
                  ) : field.type === 'single' ? (
                    <select
                      {...shared}
                      {...form.register(field.id)}
                      className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                    >
                      <option value="">Choose an option</option>
                      {field.options?.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === 'textarea' ? (
                    <Textarea
                      {...shared}
                      {...form.register(field.id)}
                      maxLength={field.maxLength ?? 4000}
                      rows={5}
                    />
                  ) : (
                    <Input
                      {...shared}
                      type={field.type}
                      min={field.min}
                      max={field.max}
                      maxLength={field.maxLength}
                      {...form.register(
                        field.id,
                        field.type === 'number'
                          ? { setValueAs: (value) => (value === '' ? undefined : Number(value)) }
                          : {},
                      )}
                    />
                  )}
                  <p id={`${id}-help`} className="text-sm text-muted-foreground">
                    {field.help}
                  </p>
                  {issue && (
                    <p id={`${id}-error`} className="text-sm text-destructive">
                      {String(issue.message)}
                    </p>
                  )}
                </div>
              );
            })}
          </fieldset>
        )}
        <div className="flex flex-wrap items-center gap-3">
          {step > 0 && (
            <Button
              type="button"
              variant="outline"
              disabled={locked}
              onClick={() => {
                setFocusField('');
                setStep((value) => value - 1);
              }}
            >
              Previous
            </Button>
          )}
          {step === 0 && onChoose && (
            <Button type="button" variant="outline" disabled={locked} onClick={onChoose}>
              Choose another service
            </Button>
          )}
          {uncertain ? (
            <Button
              type="button"
              disabled={busy || conflict}
              onClick={() => {
                if (payload.current) void send(payload.current.answers);
              }}
            >
              {busy ? 'Sending…' : 'Retry original request'}
            </Button>
          ) : (
            <Button type="submit" disabled={locked}>
              {busy
                ? 'Sending…'
                : reviewing
                  ? 'Send request'
                  : step === definition.steps.length - 1
                    ? 'Review request'
                    : 'Next'}
            </Button>
          )}
        </div>
      </form>
    </section>
  );
}
