import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { leaveReportSchema } from '@/features/reports/report.schema';
import { getLeaveReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/leaves — leave aggregates (§329, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.leaves');
  const query = leaveReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getLeaveReport(query);
  return apiSuccess(data, { message: 'Leave report', requestId });
});
