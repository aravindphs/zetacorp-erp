import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { leaveCalendarQuerySchema } from '@/features/leave/leave.schema';
import { getLeaveCalendar } from '@/features/leave/leave.queries';

export const dynamic = 'force-dynamic';

/** GET /api/leaves/calendar — approved/pending leave for a month (§282, §288). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('leave.calendar');
  const query = leaveCalendarQuerySchema.parse(
    Object.fromEntries(new URL(request.url).searchParams),
  );
  const entries = await getLeaveCalendar(query);
  return apiSuccess(entries, { message: 'Leave calendar', requestId });
});
