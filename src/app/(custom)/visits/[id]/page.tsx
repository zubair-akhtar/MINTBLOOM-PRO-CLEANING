// @polsia:user-owned — static shell for an authorized visit report.
import type { Metadata } from 'next';
import { VisitReport } from '@/components/custom/visit-report';

export const metadata: Metadata = {
  title: 'Visit report',
  description: 'Review the completion details and spot-check photos from your Mintbloom visit.',
};

export default async function VisitPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <VisitReport visitId={id} />;
}
