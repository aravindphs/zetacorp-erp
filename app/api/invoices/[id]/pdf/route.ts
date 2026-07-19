import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { logActivity } from '@/services/activity-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { getInvoiceDetail } from '@/features/invoice/invoice.queries';
import { generateInvoicePdf, type InvoicePdfData } from '@/features/invoice/invoice.pdf';
import { formatDate } from '@/utils/format';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/invoices/{id}/pdf — download the tax invoice PDF (spec §207, §211). */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  const user = await requirePermission('invoice.print');
  const { id } = await ctx.params;
  const invoice = await getInvoiceDetail(uuidSchema.parse(id));
  if (!invoice) throw new NotFoundError('Invoice not found.');

  const billing = invoice.customer.addresses[0];
  const data: InvoicePdfData = {
    company: {
      name: await getSetting('company.name', 'NSquare Energies'),
      gstin: await getSetting('company.gst_number', ''),
      address: await getSetting('company.address', ''),
      phone: await getSetting('company.phone', ''),
      email: await getSetting('company.email', ''),
    },
    invoice: {
      number: invoice.invoiceNumber,
      date: formatDate(invoice.invoiceDate),
      dueDate: invoice.dueDate ? formatDate(invoice.dueDate) : null,
      referenceNumber: invoice.referenceNumber,
      placeOfSupply: invoice.placeOfSupply,
      reverseCharge: invoice.reverseCharge,
      notes: invoice.notes,
      terms: invoice.termsConditions,
    },
    customer: {
      name: invoice.customer.customerName,
      company: invoice.customer.companyName,
      address: billing
        ? `${billing.addressLine1}, ${billing.city}, ${billing.state} ${billing.postalCode}`
        : null,
      gstin: invoice.customer.gstNumber,
      phone: invoice.customer.phone,
    },
    items: invoice.items.map((i) => ({
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
      subtotal: invoice.subtotal.toNumber(),
      discount: invoice.discount.toNumber(),
      taxable: invoice.taxableAmount.toNumber(),
      cgst: invoice.cgstAmount.toNumber(),
      sgst: invoice.sgstAmount.toNumber(),
      igst: invoice.igstAmount.toNumber(),
      roundOff: invoice.roundOff.toNumber(),
      grandTotal: invoice.grandTotal.toNumber(),
    },
    isInterState: invoice.igstAmount.toNumber() > 0,
  };

  const pdf = await generateInvoicePdf(data);
  await logActivity({ userId: user.id, activity: `Downloaded PDF for ${invoice.invoiceNumber}`, module: 'invoice', referenceId: invoice.id });

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${invoice.invoiceNumber}.pdf"`,
      'x-request-id': requestId,
    },
  });
});
