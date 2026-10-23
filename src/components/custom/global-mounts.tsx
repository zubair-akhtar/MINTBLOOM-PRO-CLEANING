// @polsia:user-owned — the agent OWNS this file (edit freely).
// Writable home for root/global UI (Cmd+K palette, global keyboard listeners,
// app-wide overlays/dialogs), mounted once at the app root by layout.tsx.
// Put root mounts here, NOT in framework-owned layout.tsx. Returns null by default.

'use client';

import { usePathname } from 'next/navigation';
import { ContactActions } from '@/components/custom/contact-actions';

const HIDDEN_ROUTE_PREFIXES = [
  '/manage',
  '/dashboard',
  '/admin',
  '/login',
  '/signup',
  '/profile',
  '/book',
] as const;

export function GlobalMounts() {
  const pathname = usePathname();
  const isHidden = HIDDEN_ROUTE_PREFIXES.some(
    (prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  );

  if (isHidden) return null;

  return <ContactActions variant="floating" />;
}
