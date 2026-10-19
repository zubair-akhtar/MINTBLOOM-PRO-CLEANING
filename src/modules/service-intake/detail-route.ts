// @polsia:framework-owned
import { intakeHandlers } from '@/lib/service-intake-config/server';

type Context = { params: Promise<{ id: string }> };
export async function GET(request: Request, context: Context) {
  return intakeHandlers.detail(request, (await context.params).id);
}
export async function PATCH(request: Request, context: Context) {
  return intakeHandlers.update(request, (await context.params).id);
}
