import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { logActivity } from '@/services/activity-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { getPaymentDetail } from '@/features/payment/payment.queries';
import { generateReceiptPdf, type ReceiptPdfData } from '@/features/payment/payment.pdf';
import { PAYMENT_METHOD_LABELS } from '@/features/payment/payment.types';
import { formatDate } from '@/utils/format';
import { COMPANY_NAME } from '@/constants/app';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/payments/{id}/receipt — download the payment receipt PDF (spec §230). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  const user = await requirePermission('payment.print');
  const { id } = await ctx.params;
  const payment = await getPaymentDetail(uuidSchema.parse(id));
  if (!payment) throw new NotFoundError('Payment not found.');

  const billing = payment.customer.addresses[0];
  const data: ReceiptPdfData = {
    company: {
      name: await getSetting('company.name', COMPANY_NAME),
      gstin: await getSetting('company.gst_number', ''),
      address: await getSetting('company.address', ''),
      phone: await getSetting('company.phone', ''),
      email: await getSetting('company.email', ''),
    },
    payment: {
      number: payment.paymentNumber,
      date: formatDate(payment.paymentDate),
      method: PAYMENT_METHOD_LABELS[payment.paymentMethod],
      referenceNumber: payment.referenceNumber,
      amount: payment.amount.toNumber(),
      remarks: payment.remarks,
      receivedBy: payment.receivedBy,
    },
    invoice: {
      number: payment.invoice.invoiceNumber,
      grandTotal: payment.invoice.grandTotal.toNumber(),
      amountPaid: payment.invoice.amountPaid.toNumber(),
      balanceDue: payment.invoice.balanceDue.toNumber(),
    },
    customer: {
      name: payment.customer.customerName,
      company: payment.customer.companyName,
      address: billing
        ? `${billing.addressLine1}, ${billing.city}, ${billing.state} ${billing.postalCode}`
        : null,
      gstin: payment.customer.gstNumber,
      phone: payment.customer.phone,
    },
  };

  const pdf = await generateReceiptPdf(data);
  await logActivity({
    userId: user.id,
    activity: `Downloaded receipt for ${payment.paymentNumber}`,
    module: 'payment',
    referenceId: payment.id,
  });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${payment.paymentNumber}.pdf"`,
      'x-request-id': requestId,
    },
  });
});
