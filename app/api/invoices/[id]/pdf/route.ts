import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { NotFoundError } from '@/lib/errors';
import { logActivity } from '@/services/activity-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { getInvoiceDetail } from '@/features/invoice/invoice.queries';
import { generateInvoicePdf, type InvoicePdfData } from '@/features/invoice/invoice.pdf';
import { buildPdfRows } from '@/features/invoice/invoice.pdf-data';
import { COMPANY_NAME } from '@/constants/app';
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
  const isInterState = invoice.igstAmount.toNumber() > 0;

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
      // The invoice snapshots its own bill-to address (editable at creation);
      // fall back to the customer's default address for older records.
      address:
        invoice.billingAddress?.trim() ||
        (billing
          ? [billing.addressLine1, billing.addressLine2, billing.city, billing.state, billing.postalCode]
              .map((p) => p?.trim())
              .filter(Boolean)
              .join(', ')
          : null),
      gstin: invoice.customer.gstNumber,
      phone: invoice.customer.phone,
    },
    rows: buildPdfRows(invoice, invoice.items, isInterState),
    totals: {
      taxable: invoice.taxableAmount.toNumber(),
      cgst: invoice.cgstAmount.toNumber(),
      sgst: invoice.sgstAmount.toNumber(),
      igst: invoice.igstAmount.toNumber(),
      roundOff: invoice.roundOff.toNumber(),
      grandTotal: invoice.grandTotal.toNumber(),
    },
    isInterState,
  };

  const pdf = await generateInvoicePdf(data);
  await logActivity({ userId: user.id, activity: `Downloaded PDF for ${invoice.invoiceNumber}`, module: 'invoice', referenceId: invoice.id });

  // Invoice numbers may be manual (e.g. "ZCS/2026-27/001"); characters illegal
  // in filenames — notably slashes — are replaced so the download is named
  // after the full invoice number instead of being truncated at the slash.
  const safeName = invoice.invoiceNumber.replace(/[\\/:*?"<>|]+/g, '-');

  return new NextResponse(Buffer.from(pdf), {
    status: 200,
    headers: {
      'Content-Type': 'application/pdf',
      'Content-Disposition': `inline; filename="${safeName}.pdf"`,
      'x-request-id': requestId,
    },
  });
});
