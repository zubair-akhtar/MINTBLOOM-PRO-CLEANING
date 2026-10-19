// @polsia:user-owned — public careers application form island.
'use client';

import { zodResolver } from '@hookform/resolvers/zod';
import { useEffect } from 'react';
import { useForm } from 'react-hook-form';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Checkbox } from '@/components/ui/checkbox';
import {
  Form,
  FormControl,
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
  CareersApplicationInput,
  CareersApplicationResult,
  type JobOpening,
  type ServiceMarket,
} from '@/lib/contracts/careers';
import { applyServerErrors } from '@/lib/forms';

interface CareersApplicationFormProps {
  openings: JobOpening[];
  markets: ServiceMarket[];
}

export function CareersApplicationForm({ openings, markets }: CareersApplicationFormProps) {
  const form = useForm<CareersApplicationInput>({
    resolver: zodResolver(CareersApplicationInput),
    defaultValues: {
      fullName: '',
      email: '',
      phone: '',
      roleInterest: '',
      openingId: undefined,
      marketId: undefined,
      availability: '',
      experience: '',
      message: '',
      consent: false,
    },
  });
  const selectedOpeningId = form.watch('openingId');
  const selectedOpening = openings.find((opening) => opening.id === selectedOpeningId);

  useEffect(() => {
    if (selectedOpening) {
      form.setValue('marketId', selectedOpening.marketId, { shouldValidate: true });
      form.setValue('roleInterest', selectedOpening.role, { shouldValidate: true });
    }
  }, [form, selectedOpening]);

  const onSubmit = form.handleSubmit(async (values) => {
    try {
      await apiFetch('/api/careers/applications', {
        method: 'POST',
        body: JSON.stringify({
          ...values,
          phone: values.phone || undefined,
          openingId: values.openingId || undefined,
          marketId: values.marketId || undefined,
          experience: values.experience || undefined,
          message: values.message || undefined,
        }),
        schema: CareersApplicationResult,
      });
      form.reset();
      toast.success('Thanks — Mintbloom received your interest.');
    } catch (error) {
      const applied = error instanceof Error && applyServerErrors(error.cause, form.setError);
      if (!applied) {
        toast.error('We could not submit your interest. Please try again.');
      }
    }
  });

  return (
    <Card className="border-primary/15 bg-card shadow-lg">
      <CardHeader>
        <CardTitle className="font-display text-h3">Tell us where you fit</CardTitle>
        <CardDescription>
          Required fields help us route your note. A general-interest submission is welcome even
          when there is no posted opening.
        </CardDescription>
      </CardHeader>
      <CardContent>
        <Form {...form}>
          <form onSubmit={onSubmit} className="grid gap-5" noValidate>
            {openings.length > 0 && (
              <FormField
                control={form.control}
                name="openingId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Opening</FormLabel>
                    <Select
                      value={field.value ?? 'general'}
                      onValueChange={(value) => {
                        field.onChange(value === 'general' ? undefined : value);
                        if (value === 'general') form.setValue('marketId', undefined);
                      }}
                    >
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="General interest" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        <SelectItem value="general">General interest</SelectItem>
                        {openings.map((opening) => (
                          <SelectItem key={opening.id} value={opening.id}>
                            {opening.title} · {opening.city}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            )}

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="fullName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Full name</FormLabel>
                    <FormControl>
                      <Input placeholder="Your name" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Email</FormLabel>
                    <FormControl>
                      <Input type="email" placeholder="you@example.com" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid gap-5 sm:grid-cols-2">
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>
                      Phone <span className="font-normal text-muted-foreground">(optional)</span>
                    </FormLabel>
                    <FormControl>
                      <Input type="tel" placeholder="(555) 555-5555" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleInterest"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Role interest</FormLabel>
                    <FormControl>
                      <Input placeholder="Cleaner, operations, or another role" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="marketId"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Market of interest{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <Select
                    value={field.value ?? 'none'}
                    onValueChange={(value) => field.onChange(value === 'none' ? undefined : value)}
                    disabled={Boolean(selectedOpening)}
                  >
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Choose a Texas market" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      <SelectItem value="none">No specific market yet</SelectItem>
                      {markets.map((market) => (
                        <SelectItem key={market.id} value={market.id}>
                          {market.city}, {market.state}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <p className="text-small text-muted-foreground">
                    {selectedOpening
                      ? 'This market is tied to the selected opening.'
                      : 'A market choice records interest; it does not confirm active hiring.'}
                  </p>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="availability"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Availability</FormLabel>
                  <FormControl>
                    <Input placeholder="Tell us when and how often you are available" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="experience"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Relevant experience{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="Cleaning, hospitality, operations, or related experience"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            <FormField
              control={form.control}
              name="message"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>
                    Anything else{' '}
                    <span className="font-normal text-muted-foreground">(optional)</span>
                  </FormLabel>
                  <FormControl>
                    <Textarea
                      placeholder="A short introduction or question for the team"
                      {...field}
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="consent"
              render={({ field }) => (
                <FormItem className="flex flex-row items-start gap-3 rounded-lg border border-border bg-muted/30 p-4">
                  <FormControl>
                    <Checkbox checked={field.value} onCheckedChange={field.onChange} />
                  </FormControl>
                  <div className="space-y-1 leading-none">
                    <FormLabel className="font-normal">
                      I consent to Mintbloom reviewing this information for hiring and market
                      planning.
                    </FormLabel>
                    <FormMessage />
                  </div>
                </FormItem>
              )}
            />

            <Button
              type="submit"
              size="lg"
              className="w-full sm:w-fit"
              disabled={form.formState.isSubmitting}
            >
              {form.formState.isSubmitting ? 'Sending…' : 'Send my interest'}
            </Button>
          </form>
        </Form>
      </CardContent>
    </Card>
  );
}
