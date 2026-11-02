// @polsia:user-owned — shared admin auth helper for payment APIs.
import 'server-only';

import { NextResponse } from 'next/server';
import { auth } from '@/lib/auth';

export async function requireAdminUser(request: Request) {
  const user = (await auth.api.getSession({ headers: request.headers }))?.user;
  const headers = { 'Cache-Control': 'no-store' };
  if (!user) return NextResponse.json({ error: 'unauthorized' }, { status: 401, headers });
  if (user.role !== 'admin')
    return NextResponse.json({ error: 'forbidden' }, { status: 403, headers });
  return user;
}

export const noStore = { 'Cache-Control': 'no-store' };
