import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { auditReportSchema } from '@/features/reports/report.schema';
import { getAuditReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/audit — paginated audit trail (§331, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.audit');
  const query = auditReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, byAction, meta } = await getAuditReport(query);
  return apiSuccess({ rows, byAction }, { message: 'Audit report', meta, requestId });
});
