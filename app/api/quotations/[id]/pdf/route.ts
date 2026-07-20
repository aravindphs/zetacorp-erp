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
      name: await getSetting('company.name', 'NSquare Energies'),
      gstin: await getSetting('company.gst_number', ''),
      address: await getSetting('company.address', ''),
      phone: await getSetting('company.phone', ''),
      email: await getSetting('company.email', ''),
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
    items: q.items.map((i) => ({
      name: i.productName,
      hsn: i.hsnCode ?? '',
      qty: i.quantity.toNumber(),
      unit: i.unit,
      rate: i.unitPrice.toNumber(),
      discount: i.discount.toNumber(),
      taxable: i.taxableValue.toNumber(),
      gstPct: i.gstPercentage.toNumber(),
      amount: i.lineTotal.toNumber(),
    })),
    totals: {
      subtotal: q.subtotal.toNumber(),
      discount: q.discount.toNumber(),
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
