// @polsia:framework-owned
import { intakeHandlers } from '@/lib/service-intake-config/server';
export async function POST(request: Request) {
  return intakeHandlers.submit(request);
}
