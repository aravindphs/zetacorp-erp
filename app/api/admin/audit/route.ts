import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { auditLogQuerySchema } from '@/features/admin/admin.schema';
import { getAuditLogs } from '@/features/admin/admin.queries';

export const dynamic = 'force-dynamic';

/** GET /api/admin/audit — paginated immutable audit trail (§361, §365). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('audit.view');
  const query = auditLogQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getAuditLogs(query);
  return apiSuccess(rows, { message: 'Audit logs', meta, requestId });
});
