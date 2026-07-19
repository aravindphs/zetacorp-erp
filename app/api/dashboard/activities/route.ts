import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getDashboardActivities } from '@/features/dashboard/dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('dashboard.view');
  const data = await getDashboardActivities();
  return apiSuccess(data, { message: 'Recent activities', requestId });
});
