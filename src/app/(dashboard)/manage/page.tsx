// @polsia:user-owned — static shell for the authenticated subscriber portal.
import type { Metadata } from 'next';
import { ManagePortal } from '@/components/custom/manage-portal';

export const metadata: Metadata = {
  title: 'Manage your service',
  description:
    'Review your Mintbloom recurring service, see the 24-hour cancellation cutoff, and manage future visits securely.',
  alternates: { canonical: '/manage' },
};

export default function ManagePage() {
  return <ManagePortal />;
}
