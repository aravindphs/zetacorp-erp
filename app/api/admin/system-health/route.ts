import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getSystemHealth } from '@/features/admin/admin.queries';

export const dynamic = 'force-dynamic';

/** GET /api/admin/system-health — live status probe (§362, §365). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('system.monitor');
  const health = await getSystemHealth();
  return apiSuccess(health, { message: 'System health', requestId });
});
