import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { logActivity } from '@/services/activity-log.service';
import { toCsv } from '@/utils/csv';
import { expenseListQuerySchema } from '@/features/expense/expense.schema';
import { getExpenseList } from '@/features/expense/expense.queries';
import { EXPENSE_STATUS_LABELS } from '@/features/expense/expense.types';

export const dynamic = 'force-dynamic';

/** GET /api/expenses/export — CSV of the current filtered set (§312). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('expense.export');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const query = expenseListQuerySchema.parse({ ...params, page: 1, pageSize: 100 });
  const { rows } = await getExpenseList(query, user);

  const headers = [
    'Expense Number',
    'Employee',
    'Category',
    'Expense Date',
    'Amount',
    'Currency',
    'Status',
    'Submitted',
    'Approved By',
    'Reimbursed',
  ];
  const csvRows = rows.map((r) => [
    r.expenseNumber,
    r.employeeName,
    r.categoryName,
    r.expenseDate.slice(0, 10),
    r.amount,
    r.currency,
    EXPENSE_STATUS_LABELS[r.status],
    r.submittedDate.slice(0, 10),
    r.approverName ?? '',
    r.reimbursedAt ? r.reimbursedAt.slice(0, 10) : '',
  ]);

  await logActivity({
    userId: user.id,
    activity: `Exported ${rows.length} expenses`,
    module: 'expense',
  });

  return new NextResponse(toCsv(headers, csvRows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="expenses-${new Date().toISOString().slice(0, 10)}.csv"`,
      'x-request-id': requestId,
    },
  });
});
