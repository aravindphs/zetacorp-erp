import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { employeeReportSchema } from '@/features/reports/report.schema';
import { getEmployeeReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/employees — headcount aggregates (§328, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.employees');
  const query = employeeReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getEmployeeReport(query);
  return apiSuccess(data, { message: 'Employee report', requestId });
});
