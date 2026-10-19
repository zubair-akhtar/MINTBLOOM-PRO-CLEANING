// @polsia:user-owned — protected one-active-request re-clean endpoint.
import 'server-only';

import { NextResponse } from 'next/server';
import { findAuthorizedVisit } from '@/lib/business/visits';
import { RecleanRequestCreate, RecleanRequestResponse } from '@/lib/contracts/visits';
import { prisma } from '@/lib/db';
import { requireAuth, type SessionUser } from '@/lib/require-auth';

export const dynamic = 'force-dynamic';

function isUniqueConstraintError(error: unknown): boolean {
  return typeof error === 'object' && error !== null && 'code' in error && error.code === 'P2002';
}

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

export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  const authenticated = await authenticatedUser(request);
  if (authenticated instanceof Response) return authenticated;

  const { id } = await context.params;
  const parsed = RecleanRequestCreate.safeParse(await request.json().catch(() => null));
  if (!parsed.success) {
    return NextResponse.json({ error: 'Invalid re-clean request' }, { status: 400 });
  }

  try {
    const authorizedVisit = await findAuthorizedVisit(id, authenticated);
    if (!authorizedVisit) {
      return NextResponse.json({ error: 'Visit not found' }, { status: 404 });
    }

    const created = await prisma.recleanRequest.create({
      data: {
        visitId: authorizedVisit.visit.id,
        requesterUserId: authenticated.id,
        status: 'active',
        reason: parsed.data.reason ?? null,
        activeKey: authorizedVisit.visit.id,
      },
      select: { id: true, status: true, reason: true, createdAt: true },
    });

    return NextResponse.json(
      RecleanRequestResponse.parse({
        recleanRequest: {
          ...created,
          createdAt: created.createdAt.toISOString(),
        },
      }),
      { status: 201 },
    );
  } catch (error: unknown) {
    if (isUniqueConstraintError(error)) {
      return NextResponse.json(
        { error: 'A re-clean request is already active for this visit' },
        { status: 409 },
      );
    }
    return NextResponse.json({ error: 'Could not submit re-clean request' }, { status: 500 });
  }
}
