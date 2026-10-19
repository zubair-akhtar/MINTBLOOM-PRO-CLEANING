// @polsia:user-owned — metadata-only server shell for the Mintbloom homepage.

import type { Metadata } from 'next';
import { Homepage } from '@/components/custom/homepage';
import { siteDescription, siteName } from '@/lib/site';

export const metadata: Metadata = {
  title: { absolute: siteName },
  description: siteDescription,
  alternates: { canonical: '/' },
};

export default function HomePage() {
  return <Homepage />;
}
