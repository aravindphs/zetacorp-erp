import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { updateLeaveSchema } from '@/features/leave/leave.schema';
import { getLeaveDetail } from '@/features/leave/leave.queries';
import { updateLeave } from '@/features/leave/leave.service';
import { getApprovalTimeline } from '@/services/approval.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/leaves/{id} — request detail with its approval timeline (§288). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('leave.view');
  const { id } = await ctx.params;
  const leave = await getLeaveDetail(uuidSchema.parse(id));
  if (!leave) throw new NotFoundError('Leave request not found.');

  const timeline = leave.approvalRequestId
    ? await getApprovalTimeline(leave.approvalRequestId)
    : [];

  return apiSuccess(
    {
      id: leave.id,
      leaveNumber: leave.leaveNumber,
      status: leave.status,
      fromDate: leave.fromDate.toISOString(),
      toDate: leave.toDate.toISOString(),
      totalDays: leave.totalDays.toNumber(),
      isHalfDay: leave.isHalfDay,
      reason: leave.reason,
      remarks: leave.remarks,
      employee: {
        id: leave.employee.id,
        name: leave.employee.fullName,
        code: leave.employee.employeeCode,
      },
      leaveType: leave.leaveType,
      timeline,
    },
    { message: 'Leave request', requestId },
  );
});

/** PUT /api/leaves/{id} — edit a draft (§287, §288). */
export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('leave.update');
  const { id } = await ctx.params;
  const data = updateLeaveSchema.parse(await request.json());
  const leave = await updateLeave(user, uuidSchema.parse(id), data);
  return apiSuccess({ id: leave.id, status: leave.status }, { message: 'Leave updated', requestId });
});
