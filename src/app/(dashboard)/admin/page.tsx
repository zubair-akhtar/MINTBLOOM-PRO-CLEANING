// @polsia:user-owned

import Link from 'next/link';

export default function AdminPage() {
  return (
    <div className="grid gap-6">
      <div>
        <p className="text-sm font-medium text-muted-foreground">Admin dashboard</p>
        <h1 className="text-3xl font-semibold tracking-normal text-foreground">Overview</h1>
      </div>
      <section className="grid gap-2 rounded-xl border border-border bg-card p-6">
        <h2 className="font-semibold text-card-foreground">Administration</h2>
        <p className="text-sm text-muted-foreground">Owner and operations workflows.</p>
        <Link
          className="text-sm font-medium text-primary underline underline-offset-4"
          href="/admin/service-requests"
        >
          Review incoming service requests
        </Link>
        <Link
          className="text-sm font-medium text-primary underline underline-offset-4"
          href="/admin/calculator"
        >
          Calculator settings (rates &amp; tax)
        </Link>
      </section>
    </div>
  );
}
