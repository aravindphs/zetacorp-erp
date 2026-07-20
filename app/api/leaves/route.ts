import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { applyLeaveSchema, leaveListQuerySchema } from '@/features/leave/leave.schema';
import { getLeaveList } from '@/features/leave/leave.queries';
import { applyForLeave } from '@/features/leave/leave.service';

export const dynamic = 'force-dynamic';

/** GET /api/leaves — filtered, paginated leave list (§276, §288). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('leave.view');
  const query = leaveListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getLeaveList(query, user);
  return apiSuccess(rows, { message: 'Leave requests', meta, requestId });
});

/** POST /api/leaves — apply for leave (§288). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('leave.create');
  const data = applyLeaveSchema.parse(await request.json());
  const leave = await applyForLeave(user, data);
  return apiSuccess(
    { id: leave.id, leaveNumber: leave.leaveNumber, status: leave.status },
    { message: 'Leave request created', status: HttpStatus.CREATED, requestId },
  );
});
