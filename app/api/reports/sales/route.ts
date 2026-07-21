import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { salesReportSchema } from '@/features/reports/report.schema';
import { getSalesReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/sales — sales aggregates (§323, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.sales');
  const query = salesReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getSalesReport(query);
  return apiSuccess(data, { message: 'Sales report', requestId });
});
