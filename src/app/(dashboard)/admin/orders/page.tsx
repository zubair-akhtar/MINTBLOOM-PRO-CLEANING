// @polsia:user-owned
import type { Metadata } from 'next';
import { AdminOrders } from '@/components/custom/admin-orders';

export const metadata: Metadata = {
  title: 'Orders | Mintbloom Pro',
};

export default function AdminOrdersPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal">Orders & quotes</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Track quote requests and PayPal payments. Sandbox captures show as Testing payment.
        </p>
      </div>
      <AdminOrders />
    </div>
  );
}
