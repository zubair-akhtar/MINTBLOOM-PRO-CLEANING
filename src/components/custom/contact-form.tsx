// @polsia:user-owned
'use client';

import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { apiFetch } from '@/lib/api-client';

// Composes the template's base shadcn primitives (Button/Input/Label/Textarea)
// styled through the theme tokens. Restyle via the brand_tokens slot + cva
// variants, or pull more primitives with `npx shadcn add` and compose them.
export function ContactForm() {
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [message, setMessage] = useState('');
  const [pending, setPending] = useState(false);
  const [errors, setErrors] = useState<{ name?: string; email?: string; message?: string }>({});
  const [ok, setOk] = useState(false);

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setPending(true);
    setErrors({});
    try {
      await apiFetch('/api/contact', {
        method: 'POST',
        body: JSON.stringify({ name, email, message }),
      });
      setOk(true);
    } catch (err) {
      const cause = (
        err as { cause?: { errors?: { name?: string; email?: string; message?: string } } }
      ).cause;
      setErrors(cause?.errors ?? { message: 'Something went wrong. Please try again.' });
    } finally {
      setPending(false);
    }
  }

  if (ok) {
    return (
      <output className="block py-4 text-center text-sm font-medium text-foreground">
        Request received. We’ll review the location and scope; this does not confirm service
        availability or a booking.
      </output>
    );
  }

  return (
    <form onSubmit={handleSubmit} className="flex flex-col gap-3" noValidate>
      <Label htmlFor="contact-name">Your name</Label>
      <Input
        id="contact-name"
        name="name"
        type="text"
        placeholder="Your name"
        value={name}
        onChange={(e) => setName(e.target.value)}
        required
        autoComplete="name"
        aria-describedby={errors.name ? 'contact-name-error' : undefined}
        aria-invalid={errors.name ? true : undefined}
      />
      {errors.name ? (
        <p id="contact-name-error" role="alert" className="text-sm text-destructive">
          {errors.name}
        </p>
      ) : null}
      <Label htmlFor="contact-email">Email address</Label>
      <Input
        id="contact-email"
        name="email"
        type="email"
        placeholder="you@example.com"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
        required
        autoComplete="email"
        aria-describedby={errors.email ? 'contact-email-error' : undefined}
        aria-invalid={errors.email ? true : undefined}
      />
      {errors.email ? (
        <p id="contact-email-error" role="alert" className="text-sm text-destructive">
          {errors.email}
        </p>
      ) : null}
      <Label htmlFor="contact-message">Area request details</Label>
      <Textarea
        id="contact-message"
        name="message"
        placeholder="Texas city, ZIP, desired service, and useful scope details"
        value={message}
        onChange={(e) => setMessage(e.target.value)}
        required
        aria-describedby={
          errors.message ? 'contact-message-help contact-message-error' : 'contact-message-help'
        }
        aria-invalid={errors.message ? true : undefined}
      />
      <p id="contact-message-help" className="text-sm text-muted-foreground">
        Include the Texas city, ZIP code, desired service, and any details that help describe the
        scope.
      </p>
      {errors.message ? (
        <p id="contact-message-error" role="alert" className="text-sm text-destructive">
          {errors.message}
        </p>
      ) : null}
      <Button type="submit" disabled={pending} className="w-full">
        {pending ? 'Sending request…' : 'Request my area'}
      </Button>
    </form>
  );
}
