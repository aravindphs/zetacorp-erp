import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { leaveListQuerySchema } from '@/features/leave/leave.schema';
import { getTeamLeave } from '@/features/leave/leave.queries';

export const dynamic = 'force-dynamic';

/** GET /api/leaves/team — direct reports' leave (§283, §288). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('leave.team');
  const query = leaveListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getTeamLeave(user, query);
  return apiSuccess(rows, { message: 'Team leave', meta, requestId });
});
