// @polsia:user-owned
//
// Shared zod schema for a contact message. Safe to import from a 'use client'
// file: no server-only imports, so the client can reuse the input TYPE without
// pulling in the route handler or Prisma.

import { z } from 'zod';

export const contactSchema = z.object({
  name: z.string().min(1, 'Please enter your name.'),
  email: z.string().email('Please enter a valid email address.'),
  message: z.string().min(1, 'Please enter a message.'),
});

export type ContactInput = z.infer<typeof contactSchema>;
