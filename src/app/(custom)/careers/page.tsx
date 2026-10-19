// @polsia:user-owned — SEO shell for the public Mintbloom careers surface.

import type { Metadata } from 'next';
import { CareersPage } from '@/components/custom/careers-page';

export const metadata: Metadata = {
  title: 'Careers | Mintbloom',
  description:
    'Explore posted Mintbloom cleaning and operations openings across Texas, or share your interest in a future market opportunity.',
  alternates: { canonical: '/careers' },
};

export default function CareersRoutePage() {
  return <CareersPage />;
}
