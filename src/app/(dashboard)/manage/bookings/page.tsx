// @polsia:user-owned — static owner bookings shell; data loads in the client island.
import type { Metadata } from 'next';
import { OwnerBookings } from '@/components/custom/owner-bookings';

export const metadata: Metadata = {
  title: 'Owner bookings',
  description: 'Private Mintbloom booking and service-request operations view.',
  robots: { index: false, follow: false },
  alternates: { canonical: '/manage/bookings' },
};

export default function OwnerBookingsPage() {
  return <OwnerBookings />;
}
