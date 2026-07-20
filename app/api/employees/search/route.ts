import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getEmployeeOptions } from '@/features/workforce/employee.queries';

export const dynamic = 'force-dynamic';

/** GET /api/employees/search?q= — active employees for pickers (§257, §261). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('employee.view');
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const options = await getEmployeeOptions(q);
  return apiSuccess(options, { message: 'Employees', requestId });
});
