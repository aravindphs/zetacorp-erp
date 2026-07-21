import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { expenseReportSchema } from '@/features/reports/report.schema';
import { getExpenseReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/expenses — expense aggregates (§330, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.expenses');
  const query = expenseReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getExpenseReport(query);
  return apiSuccess(data, { message: 'Expense report', requestId });
});
