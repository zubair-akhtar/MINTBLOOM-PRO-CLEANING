// @polsia:user-owned — emits Meta Pixel page views for App Router navigation.
'use client';

import { usePathname } from 'next/navigation';
import { useEffect, useRef } from 'react';
import { trackMetaPixelEvent } from '@/lib/meta-pixel';

export function MetaPixelPageView() {
  const pathname = usePathname();
  const previousPathname = useRef<string | null>(null);

  useEffect(() => {
    if (previousPathname.current === null) {
      previousPathname.current = pathname;
      return;
    }

    if (previousPathname.current === pathname) return;
    previousPathname.current = pathname;
    trackMetaPixelEvent('PageView');
  }, [pathname]);

  return null;
}
