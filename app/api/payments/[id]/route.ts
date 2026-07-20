import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { getPaymentDetail } from '@/features/payment/payment.queries';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/payments/{id} — single payment record (spec §231, §236). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('payment.view');
  const { id } = await ctx.params;
  const payment = await getPaymentDetail(uuidSchema.parse(id));
  if (!payment) throw new NotFoundError('Payment not found.');

  return apiSuccess(
    {
      id: payment.id,
      paymentNumber: payment.paymentNumber,
      paymentDate: payment.paymentDate.toISOString(),
      paymentMethod: payment.paymentMethod,
      status: payment.status,
      referenceNumber: payment.referenceNumber,
      amount: payment.amount.toNumber(),
      remarks: payment.remarks,
      receivedBy: payment.receivedBy,
      customer: {
        id: payment.customer.id,
        name: payment.customer.customerName,
        code: payment.customer.customerCode,
      },
      invoice: {
        id: payment.invoice.id,
        number: payment.invoice.invoiceNumber,
        grandTotal: payment.invoice.grandTotal.toNumber(),
        amountPaid: payment.invoice.amountPaid.toNumber(),
        balanceDue: payment.invoice.balanceDue.toNumber(),
      },
    },
    { message: 'Payment', requestId },
  );
});
