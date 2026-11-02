// @polsia:user-owned
import type { Metadata } from 'next';
import { AdminPaymentSettings } from '@/components/custom/admin-payment-settings';

export const metadata: Metadata = {
  title: 'Payment settings | Mintbloom Pro',
};

export default function AdminPaymentsPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin</p>
        <h1 className="text-3xl font-semibold tracking-normal">Payment settings</h1>
        <p className="mt-2 max-w-2xl text-muted-foreground">
          Configure PayPal and Venmo for online booking. Leave both inactive to hide online pay on
          /book.
        </p>
      </div>
      <AdminPaymentSettings />
    </div>
  );
}
