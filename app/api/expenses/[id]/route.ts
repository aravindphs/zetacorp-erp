import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { updateExpenseSchema } from '@/features/expense/expense.schema';
import { getExpenseDetail } from '@/features/expense/expense.queries';
import { updateExpense } from '@/features/expense/expense.service';
import { getApprovalTimeline } from '@/services/approval.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/expenses/{id} — claim detail with approval timeline (§312). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('expense.view');
  const { id } = await ctx.params;
  const expense = await getExpenseDetail(uuidSchema.parse(id));
  if (!expense) throw new NotFoundError('Expense not found.');

  const timeline = expense.approvalRequestId
    ? await getApprovalTimeline(expense.approvalRequestId)
    : [];

  return apiSuccess(
    {
      id: expense.id,
      expenseNumber: expense.expenseNumber,
      status: expense.status,
      expenseDate: expense.expenseDate.toISOString(),
      amount: expense.amount.toNumber(),
      currency: expense.currency,
      description: expense.description,
      vendorName: expense.vendorName,
      referenceNumber: expense.referenceNumber,
      reimbursedAt: expense.reimbursedAt?.toISOString() ?? null,
      employee: {
        id: expense.employee.id,
        name: expense.employee.fullName,
        code: expense.employee.employeeCode,
      },
      category: expense.category,
      receiptCount: expense.receipts.length,
      transactions: expense.transactions.map((t) => ({
        transactionNumber: t.transactionNumber,
        transactionType: t.transactionType,
        debit: t.debit.toNumber(),
        credit: t.credit.toNumber(),
      })),
      timeline,
    },
    { message: 'Expense', requestId },
  );
});

/** PUT /api/expenses/{id} — edit a draft (§311, §312). */
export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('expense.update');
  const { id } = await ctx.params;
  const data = updateExpenseSchema.parse(await request.json());
  const expense = await updateExpense(user, uuidSchema.parse(id), data);
  return apiSuccess(
    { id: expense.id, status: expense.status },
    { message: 'Expense updated', requestId },
  );
});
