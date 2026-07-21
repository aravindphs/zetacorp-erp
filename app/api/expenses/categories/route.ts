import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getExpenseCategoryOptions } from '@/features/expense/expense.queries';

export const dynamic = 'force-dynamic';

/** GET /api/expenses/categories — active categories for pickers (§312). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('expense.view');
  const categories = await getExpenseCategoryOptions();
  return apiSuccess(categories, { message: 'Expense categories', requestId });
});
