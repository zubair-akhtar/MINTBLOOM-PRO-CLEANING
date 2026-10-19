// @polsia:user-owned — Compatibility redirect for the former admin URL.
import { redirect } from 'next/navigation';

export default async function ServiceRequestRedirect({
  params,
  searchParams,
}: {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const { id } = await params;
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(await searchParams)) {
    if (Array.isArray(value)) {
      for (const item of value) query.append(key, item);
    } else if (value !== undefined) {
      query.set(key, value);
    }
  }
  const suffix = query.size ? `?${query}` : '';
  redirect(`/admin/service-requests/${encodeURIComponent(id)}${suffix}`);
}
