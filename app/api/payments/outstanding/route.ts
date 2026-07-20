import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getOutstandingInvoices } from '@/features/payment/payment.queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/payments/outstanding?q= — posted invoices with a balance due, for
 * the record-payment invoice picker (spec §225). Paid invoices are excluded.
 */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('payment.create');
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const invoices = await getOutstandingInvoices(q);
  return apiSuccess(invoices, { message: 'Outstanding invoices', requestId });
});
