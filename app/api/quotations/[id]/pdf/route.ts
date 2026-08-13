import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { logActivity } from '@/services/activity-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { getQuotationDetail } from '@/features/quotation/quotation.queries';
import { generateInvoicePdf, type InvoicePdfData } from '@/features/invoice/invoice.pdf';
import { formatDate } from '@/utils/format';
import { COMPANY_NAME } from '@/constants/app';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/quotations/{id}/pdf — quotation PDF (spec §178, §183). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  const user = await requirePermission('quotation.print');
  const { id } = await ctx.params;
  const q = await getQuotationDetail(uuidSchema.parse(id));
  if (!q) throw new NotFoundError('Quotation not found.');

  const billing = q.customer.addresses[0];
  const data: InvoicePdfData = {
    company: {
      name: await getSetting('company.name', COMPANY_NAME),
      gstin: await getSetting('company.gst_number', ''),
      cin: await getSetting<string>('company.cin', ''),
      address: await getSetting('company.address', ''),
      phone: await getSetting('company.phone', ''),
      email: await getSetting('company.email', ''),
      state: await getSetting<string>('company.state', ''),
    },
    invoice: {
      number: q.quotationNumber,
      date: formatDate(q.quotationDate),
      dueDate: q.validUntil ? formatDate(q.validUntil) : null,
      referenceNumber: q.referenceNumber,
      placeOfSupply: q.placeOfSupply,
      reverseCharge: false,
      notes: q.remarks,
      terms: q.termsConditions,
    },
    customer: {
      name: q.customer.customerName,
      company: q.customer.companyName,
      address: billing
        ? `${billing.addressLine1}, ${billing.city}, ${billing.state} ${billing.postalCode}`
        : null,
      gstin: q.customer.gstNumber,
      phone: q.customer.phone,
    },
    // Quotations remain itemized for now; contract billing lands here next.
    rows: q.items.map((i) => {
      const gst = i.gstAmount.toNumber();
      const isInter = q.igstAmount.toNumber() > 0;
      const half = Math.round((gst / 2) * 100) / 100;
      const rate = i.gstPercentage.toNumber();
      return {
        description: i.productName,
        hsn: i.hsnCode ?? '',
        taxable: i.taxableValue.toNumber(),
        gstRateLabel: isInter ? `${rate}% (IGST)` : `${rate}% (${rate / 2}+${rate / 2})`,
        cgst: isInter ? 0 : half,
        sgst: isInter ? 0 : Math.round((gst - half) * 100) / 100,
        igst: isInter ? gst : 0,
        total: i.lineTotal.toNumber(),
      };
    }),
    totals: {
      taxable: q.taxableAmount.toNumber(),
      cgst: q.cgstAmount.toNumber(),
      sgst: q.sgstAmount.toNumber(),
      igst: q.igstAmount.toNumber(),
      roundOff: q.roundOff.toNumber(),
      grandTotal: q.grandTotal.toNumber(),
    },
    isInterState: q.igstAmount.toNumber() > 0,
  };

  const pdf = await generateInvoicePdf(data, 'QUOTATION');
  await logActivity({ userId: user.id, activity: `Downloaded PDF for ${q.quotationNumber}`, module: 'quotation', referenceId: q.id });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${q.quotationNumber}.pdf"`,
      'x-request-id': requestId,
    },
  });
});
