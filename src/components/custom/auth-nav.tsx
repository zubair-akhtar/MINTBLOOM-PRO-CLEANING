// @polsia:user-owned — seeded by polsia/modules/better-auth; restyle freely.
'use client';

import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { signOut, useSession } from '@/lib/auth-client';

export function AuthNav({ onNavigate }: { onNavigate?: () => void } = {}) {
  const { data: session, isPending } = useSession();

  // Render nothing until the session resolves — avoids a Sign-in→Profile flash.
  if (isPending) return null;

  if (!session?.user) {
    return (
      <div className="flex items-center gap-2">
        <Button asChild variant="ghost">
          <Link href="/login" onClick={onNavigate}>
            Sign in
          </Link>
        </Button>
        <Button asChild>
          <Link href="/signup" onClick={onNavigate}>
            Sign up
          </Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-2">
      <Button asChild variant="ghost">
        <Link href="/profile" onClick={onNavigate}>
          Profile
        </Link>
      </Button>
      <Button
        type="button"
        variant="secondary"
        onClick={async () => {
          await signOut();
          window.location.assign('/');
        }}
      >
        Sign out
      </Button>
    </div>
  );
}
