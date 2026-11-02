// @polsia:user-owned — billing portal disabled (Stripe removed; bookings use PayPal).
import 'server-only';

import { NextResponse } from 'next/server';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

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

  return NextResponse.json(
    {
      error:
        'The hosted Stripe billing portal is disabled. Contact Mintbloom for subscription changes.',
    },
    { status: 503 },
  );
}
