import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { reimburseExpenseSchema } from '@/features/expense/expense.schema';
import { reimburseExpense } from '@/features/expense/expense.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/**
 * POST /api/expenses/{id}/reimburse — record reimbursement of an approved
 * claim; writes the matching financial transaction (§308, §311, §312).
 */
export const POST = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('expense.reimburse');
  const { id } = await ctx.params;
  const data = reimburseExpenseSchema.parse(await request.json());
  await reimburseExpense(user, uuidSchema.parse(id), data);
  return apiSuccess(null, { message: 'Reimbursement recorded', requestId });
});
