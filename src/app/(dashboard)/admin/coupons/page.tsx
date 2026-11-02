// @polsia:user-owned
import type { Metadata } from 'next';
import { AdminCoupons } from '@/components/custom/admin-coupons';

export const metadata: Metadata = {
  title: 'Coupons | Mintbloom Pro',
};

export default function AdminCouponsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal">Coupons</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Create limited or unlimited coupon codes for online payments and/or quote requests.
        </p>
      </div>
      <AdminCoupons />
    </div>
  );
}
