import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { expenseListQuerySchema, submitExpenseSchema } from '@/features/expense/expense.schema';
import { getExpenseList } from '@/features/expense/expense.queries';
import { createExpense } from '@/features/expense/expense.service';

export const dynamic = 'force-dynamic';

/** GET /api/expenses — filtered, paginated claim list (§302, §312). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('expense.view');
  const query = expenseListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getExpenseList(query, user);
  return apiSuccess(rows, { message: 'Expenses', meta, requestId });
});

/** POST /api/expenses — submit a claim (§312). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('expense.create');
  const data = submitExpenseSchema.parse(await request.json());
  const expense = await createExpense(user, data);
  return apiSuccess(
    { id: expense.id, expenseNumber: expense.expenseNumber, status: expense.status },
    { message: 'Expense created', status: HttpStatus.CREATED, requestId },
  );
});
