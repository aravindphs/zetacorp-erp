import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getDashboardRecent } from '@/features/dashboard/dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_request, requestId) => {
  const user = await requirePermission('dashboard.view');
  const data = await getDashboardRecent(user);
  return apiSuccess(data, { message: 'Recent activity', requestId });
});
