import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getExecutiveReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/executive — organisation-wide KPIs (§321, §338). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('report.view');
  const data = await getExecutiveReport();
  return apiSuccess(data, { message: 'Executive report', requestId });
});
