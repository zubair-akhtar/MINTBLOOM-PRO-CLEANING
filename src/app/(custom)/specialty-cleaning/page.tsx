// @polsia:user-owned — specialty-cleaning SEO shell; catalog data lives in the client island.
import type { Metadata } from 'next';
import { SpecialtyCleaningPage } from '@/components/custom/specialty-cleaning-page';

export const metadata: Metadata = {
  title: 'Specialty cleaning for handover, moves, and sanitation',
  description:
    'Explore Mintbloom specialty cleaning for post-construction turnover, move-in/move-out, and sanitation-focused spaces in Lubbock and nearby areas.',
  alternates: { canonical: '/specialty-cleaning' },
};

export default function SpecialtyCleaningRoute() {
  return <SpecialtyCleaningPage />;
}
