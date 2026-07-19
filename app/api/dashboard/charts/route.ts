import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getDashboardCharts } from '@/features/dashboard/dashboard.service';
import { chartRangeSchema } from '@/features/dashboard/dashboard.schema';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('dashboard.view');
  const range = chartRangeSchema.parse(
    new URL(request.url).searchParams.get('range') ?? undefined,
  );
  const data = await getDashboardCharts(user, range);
  return apiSuccess(data, { message: 'Dashboard charts', requestId });
});
