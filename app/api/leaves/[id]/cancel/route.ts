import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { cancelLeaveSchema } from '@/features/leave/leave.schema';
import { cancelLeave } from '@/features/leave/leave.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/leaves/{id}/cancel — withdraw a draft or pending request (§288).
 * Ownership is enforced in the service for callers without `leave.cancel`.
 */
export const POST = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('leave.view');
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const { reason } = cancelLeaveSchema.parse(body);
  await cancelLeave(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Leave cancelled', requestId });
});
