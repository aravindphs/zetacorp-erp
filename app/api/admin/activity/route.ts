import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { activityLogQuerySchema } from '@/features/admin/admin.schema';
import { getActivityLogs } from '@/features/admin/admin.queries';

export const dynamic = 'force-dynamic';

/** GET /api/admin/activity — paginated activity log (§360, §365). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('activity.view');
  const query = activityLogQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const { rows, meta } = await getActivityLogs(query);
  return apiSuccess(rows, { message: 'Activity logs', meta, requestId });
});
