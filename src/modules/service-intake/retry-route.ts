// @polsia:framework-owned
import { intakeHandlers } from '@/lib/service-intake-config/server';
export async function POST(request: Request, context: { params: Promise<{ id: string }> }) {
  return intakeHandlers.retry(request, (await context.params).id);
}
