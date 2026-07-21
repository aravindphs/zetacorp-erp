import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { cancelExpenseSchema } from '@/features/expense/expense.schema';
import { cancelExpense } from '@/features/expense/expense.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/expenses/{id}/cancel — withdraw a draft or pending claim (§312).
 * Ownership is enforced in the service for callers without `expense.cancel`.
 */
export const POST = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('expense.view');
  const { id } = await ctx.params;
  const body = await request.json().catch(() => ({}));
  const { reason } = cancelExpenseSchema.parse(body);
  await cancelExpense(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Expense cancelled', requestId });
});
