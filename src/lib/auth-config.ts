// @polsia:user-owned — configure better-auth here (spread into betterAuth() by @/lib/auth).
// Add emailAndPassword options, plugins, session, socialProviders, databaseHooks, etc.
// Framework owns db/secret/baseURL/admin() + the owner-admin grant (no-op if set here).
//
// Welcome email / signup side-effect (runs alongside the owner-admin grant — install `email`):
//   import { sendEmail } from '@/lib/email/send';
//   databaseHooks: { user: { create: { after: async (user) => {
//     await sendEmail({ to: user.email, subject: 'Welcome', html: '<p>Welcome!</p>' }).catch(() => {});
//   } } } },
// Add a plugin: `plugins: [organization()]` (admin() is added for you).
//
// Per-user fields (a `username`, profile, prefs): don't add a column to `User` (auth.prisma
// is locked) or use `user.additionalFields` (needs that locked column). Make a user-owned
// `prisma/schema/profile.prisma` (model UserProfile { userId String @unique /* fields */ },
// scalar userId) and create the row at signup:
//   import { prisma } from '@/lib/db';
//   databaseHooks: { user: { create: { after: async (user) => {
//     await prisma.userProfile.create({ data: { userId: user.id } }).catch(() => {});
//   } } } },

import type { BetterAuthOptions } from 'better-auth';
import { sendEmail } from '@/lib/email/send';
import { renderEmail } from '@/lib/email/templates';

export const authConfig: BetterAuthOptions = {
  emailAndPassword: {
    enabled: true,
    requireEmailVerification: true,
  },
  emailVerification: {
    sendOnSignUp: true,
    sendOnSignIn: true,
    async sendVerificationEmail({ user, url }) {
      const { html, text } = renderEmail({
        heading: 'Verify your Mintbloom email',
        body: [
          `Hi ${user.name},`,
          'Confirm your email address to access your Mintbloom service details.',
        ],
        cta: { label: 'Verify email address', url },
        footer: 'This link expires in one hour.',
      });
      await sendEmail({ to: user.email, subject: 'Verify your Mintbloom email', html, text });
    },
  },
};
