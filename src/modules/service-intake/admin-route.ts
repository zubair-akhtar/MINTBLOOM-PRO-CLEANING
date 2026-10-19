// @polsia:framework-owned
import { intakeHandlers } from '@/lib/service-intake-config/server';
export async function GET(request: Request) {
  return intakeHandlers.list(request);
}
