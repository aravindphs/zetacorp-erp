import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { logActivity } from '@/services/activity-log.service';
import { toCsv } from '@/utils/csv';
import { paymentListQuerySchema } from '@/features/payment/payment.schema';
import { listPaymentsForExport } from '@/features/payment/payment.queries';

export const dynamic = 'force-dynamic';

/** GET /api/payments/export — CSV of the current filtered set (spec §235, §236). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('payment.export');
  const query = paymentListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const payments = await listPaymentsForExport(query);

  const headers = [
    'Payment Number',
    'Customer',
    'Invoice',
    'Payment Date',
    'Method',
    'Reference Number',
    'Amount',
    'Status',
    'Received By',
    'Remarks',
  ];
  const rows = payments.map((p) => [
    p.paymentNumber,
    p.customerName,
    p.invoiceNumber,
    p.paymentDate,
    p.method,
    p.referenceNumber,
    p.amount,
    p.status,
    p.receivedBy,
    p.remarks,
  ]);

  await logActivity({
    userId: user.id,
    activity: `Exported ${payments.length} payments`,
    module: 'payment',
  });

  const csv = toCsv(headers, rows);
  const filename = `payments-${new Date().toISOString().slice(0, 10)}.csv`;

  return new NextResponse(csv, {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'x-request-id': requestId,
    },
  });
});
