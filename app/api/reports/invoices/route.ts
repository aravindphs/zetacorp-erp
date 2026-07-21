import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { invoiceReportSchema } from '@/features/reports/report.schema';
import { getInvoiceReport } from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/** GET /api/reports/invoices — invoice register aggregates (§326, §338). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('report.invoices');
  const query = invoiceReportSchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const data = await getInvoiceReport(query);
  return apiSuccess(data, { message: 'Invoice report', requestId });
});
