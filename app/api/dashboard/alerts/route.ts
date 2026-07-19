import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getDashboardAlerts } from '@/features/dashboard/dashboard.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (_request, requestId) => {
  const user = await requirePermission('dashboard.view');
  const data = await getDashboardAlerts(user);
  return apiSuccess(data, { message: 'Dashboard alerts', requestId });
});
