// @polsia:user-owned — authenticated redirect to the hosted billing portal.
import 'server-only';

import { NextResponse } from 'next/server';
import { BillingPortalResponse } from '@/lib/contracts/manage-subscription';
import { env } from '@/lib/env';
import { requireAuth, type SessionUser } from '@/lib/require-auth';
import {
  createCustomerPortalSession,
  StripeBillingConfigurationError,
  StripeBillingNotEnabledError,
  StripeBillingOnboardingError,
} from '@/lib/stripe-billing/client';

export const dynamic = 'force-dynamic';

async function authenticatedUser(request: Request): Promise<SessionUser | Response> {
  try {
    const user = await requireAuth(request);
    if (!user.emailVerified) {
      return NextResponse.json({ error: 'Email verification required' }, { status: 403 });
    }
    return user;
  } catch (response) {
    return response as Response;
  }
}

export async function POST(request: Request) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  try {
    const result = await createCustomerPortalSession({
      customerEmail: authenticated.email,
      returnUrl: `${env.NEXT_PUBLIC_APP_URL.replace(/\/+$/, '')}/manage`,
    });
    return NextResponse.json(BillingPortalResponse.parse({ url: result.url }));
  } catch (error) {
    if (
      error instanceof StripeBillingConfigurationError ||
      error instanceof StripeBillingNotEnabledError ||
      error instanceof StripeBillingOnboardingError
    ) {
      return NextResponse.json(
        { error: 'Billing portal is currently unavailable' },
        { status: 503 },
      );
    }
    return NextResponse.json({ error: 'Could not open billing portal' }, { status: 502 });
  }
}
