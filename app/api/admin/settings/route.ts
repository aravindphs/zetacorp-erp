import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getSettingsByCategory } from '@/features/admin/admin.queries';

export const dynamic = 'force-dynamic';

/** GET /api/admin/settings — all settings grouped by category (§365). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('settings.view');
  const settings = await getSettingsByCategory();
  return apiSuccess(settings, { message: 'System settings', requestId });
});
