import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { paymentReportSchema } from '@/features/reports/report.schema';
import { getPaymentReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/payments — collection aggregates (§327, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.payments');
  const query = paymentReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getPaymentReport(query);
  return apiSuccess(data, { message: 'Payment report', requestId });
});
