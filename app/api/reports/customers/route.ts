import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { customerReportSchema } from '@/features/reports/report.schema';
import { getCustomerReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/customers — customer aggregates (§324, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.customers');
  const query = customerReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getCustomerReport(query);
  return apiSuccess(data, { message: 'Customer report', requestId });
});
