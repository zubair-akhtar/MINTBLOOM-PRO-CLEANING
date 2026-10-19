// @polsia:user-owned — Customize this screen for your business.
import { RequestDetail } from '@/components/custom/service-intake/request-detail';

export default async function ServiceRequestPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  return <RequestDetail id={id} />;
}
