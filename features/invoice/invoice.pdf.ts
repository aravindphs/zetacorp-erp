import 'server-only';

/**
 * Invoice PDF generation with pdf-lib (spec §207, §208). A4 portrait, GST tax
 * invoice: company header, invoice + customer details, item table with HSN and
 * GST, tax summary, grand total, amount in words, terms, and signatory. Rows
 * paginate onto additional A4 pages when needed.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { rupeesInWords } from '@/utils/number-to-words';

export interface InvoicePdfData {
  company: { name: string; gstin: string; address: string; phone: string; email: string };
  invoice: {
    number: string;
    date: string;
    dueDate: string | null;
    referenceNumber: string | null;
    placeOfSupply: string | null;
    reverseCharge: boolean;
    notes: string | null;
    terms: string | null;
  };
  customer: {
    name: string;
    company: string | null;
    address: string | null;
    gstin: string | null;
    phone: string | null;
  };
  items: {
    name: string;
    hsn: string;
    qty: number;
    unit: string;
    rate: number;
    discount: number;
    taxable: number;
    gstPct: number;
    amount: number;
  }[];
  totals: {
    subtotal: number;
    discount: number;
    taxable: number;
    cgst: number;
    sgst: number;
    igst: number;
    roundOff: number;
    grandTotal: number;
  };
  isInterState: boolean;
}

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
// StandardFonts (Helvetica) can only encode WinAnsi; the ₹ glyph is not in it,
// so we use "Rs." in the PDF to avoid embedding a custom font.
const INR = (n: number) =>
  `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generateInvoicePdf(data: InvoicePdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) => {
    // WinAnsi (StandardFonts) can't encode chars outside Latin-1 — replace them
    // so unexpected unicode in dynamic data never crashes PDF generation.
    const safe = (s ?? '').replace(/[^\x00-\xFF]/g, '?');
    p.drawText(safe, {
      x,
      y: yy,
      size: opts.size ?? 9,
      font: opts.font ?? font,
      color: rgb(...(opts.color ?? [0.1, 0.1, 0.1])),
    });
  };
  const line = (p: PDFPage, x1: number, yy: number, x2: number) =>
    p.drawLine({ start: { x: x1, y: yy }, end: { x: x2, y: yy }, thickness: 0.5, color: rgb(0.8, 0.8, 0.8) });

  // Header
  text(page, data.company.name, M, y, { size: 16, font: bold });
  text(page, 'TAX INVOICE', A4.w - M - 90, y, { size: 14, font: bold });
  y -= 16;
  text(page, data.company.address, M, y, { size: 8 });
  y -= 11;
  text(page, `GSTIN: ${data.company.gstin || '—'}`, M, y, { size: 8 });
  text(page, `${data.company.phone}  ${data.company.email}`, M, y - 11, { size: 8 });
  y -= 24;
  line(page, M, y, A4.w - M);
  y -= 16;

  // Invoice meta + bill to (two columns)
  const colR = A4.w / 2 + 10;
  text(page, 'Bill To', M, y, { font: bold, size: 9 });
  text(page, 'Invoice details', colR, y, { font: bold, size: 9 });
  y -= 13;
  const billTo = [
    data.customer.company ?? data.customer.name,
    data.customer.company ? data.customer.name : '',
    data.customer.address ?? '',
    data.customer.gstin ? `GSTIN: ${data.customer.gstin}` : '',
    data.customer.phone ?? '',
  ].filter(Boolean);
  const meta = [
    `Invoice #: ${data.invoice.number}`,
    `Date: ${data.invoice.date}`,
    data.invoice.dueDate ? `Due: ${data.invoice.dueDate}` : '',
    data.invoice.referenceNumber ? `Ref: ${data.invoice.referenceNumber}` : '',
    data.invoice.placeOfSupply ? `Place of supply: ${data.invoice.placeOfSupply}` : '',
    `Reverse charge: ${data.invoice.reverseCharge ? 'Yes' : 'No'}`,
  ].filter(Boolean);
  const rowsCount = Math.max(billTo.length, meta.length);
  for (let i = 0; i < rowsCount; i++) {
    if (billTo[i]) text(page, billTo[i]!, M, y - i * 11, { size: 8 });
    if (meta[i]) text(page, meta[i]!, colR, y - i * 11, { size: 8 });
  }
  y -= rowsCount * 11 + 12;

  // Item table header
  const cols = { sno: M, name: M + 24, hsn: 300, qty: 345, rate: 390, taxable: 445, gst: 500, amount: A4.w - M };
  const drawTableHeader = (p: PDFPage, yy: number) => {
    text(p, '#', cols.sno, yy, { font: bold, size: 8 });
    text(p, 'Item', cols.name, yy, { font: bold, size: 8 });
    text(p, 'HSN', cols.hsn, yy, { font: bold, size: 8 });
    text(p, 'Qty', cols.qty, yy, { font: bold, size: 8 });
    text(p, 'Rate', cols.rate, yy, { font: bold, size: 8 });
    text(p, 'Taxable', cols.taxable, yy, { font: bold, size: 8 });
    text(p, 'GST', cols.gst, yy, { font: bold, size: 8 });
    text(p, 'Amount', cols.amount - 40, yy, { font: bold, size: 8 });
  };
  line(page, M, y + 4, A4.w - M);
  drawTableHeader(page, y - 6);
  y -= 12;
  line(page, M, y + 2, A4.w - M);
  y -= 12;

  data.items.forEach((item, i) => {
    if (y < M + 140) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
      drawTableHeader(page, y);
      y -= 16;
    }
    text(page, String(i + 1), cols.sno, y, { size: 8 });
    text(page, item.name.slice(0, 42), cols.name, y, { size: 8 });
    text(page, item.hsn || '—', cols.hsn, y, { size: 8 });
    text(page, `${item.qty} ${item.unit}`, cols.qty, y, { size: 8 });
    text(page, INR(item.rate), cols.rate, y, { size: 8 });
    text(page, INR(item.taxable), cols.taxable, y, { size: 8 });
    text(page, `${item.gstPct}%`, cols.gst, y, { size: 8 });
    text(page, INR(item.amount), cols.amount - 40, y, { size: 8 });
    y -= 13;
  });

  line(page, M, y + 4, A4.w - M);
  y -= 14;

  // Totals (right aligned block)
  const tx = 400;
  const totalsRows: [string, string][] = [
    ['Subtotal', INR(data.totals.subtotal)],
    ...(data.totals.discount > 0 ? ([['Discount', `- ${INR(data.totals.discount)}`]] as [string, string][]) : []),
    ['Taxable', INR(data.totals.taxable)],
    ...(data.isInterState
      ? ([['IGST', INR(data.totals.igst)]] as [string, string][])
      : ([['CGST', INR(data.totals.cgst)], ['SGST', INR(data.totals.sgst)]] as [string, string][])),
    ...(data.totals.roundOff !== 0 ? ([['Round off', INR(data.totals.roundOff)]] as [string, string][]) : []),
  ];
  for (const [label, val] of totalsRows) {
    text(page, label, tx, y, { size: 9 });
    text(page, val, cols.amount - 60, y, { size: 9 });
    y -= 13;
  }
  line(page, tx, y + 4, A4.w - M);
  y -= 12;
  text(page, 'Grand Total', tx, y, { font: bold, size: 11 });
  text(page, INR(data.totals.grandTotal), cols.amount - 70, y, { font: bold, size: 11 });
  y -= 22;

  text(page, `Amount in words: ${rupeesInWords(data.totals.grandTotal)}`, M, y, { size: 8, font: bold });
  y -= 20;

  if (data.invoice.notes) {
    text(page, 'Notes:', M, y, { font: bold, size: 8 });
    text(page, data.invoice.notes.slice(0, 120), M + 34, y, { size: 8 });
    y -= 14;
  }
  if (data.invoice.terms) {
    text(page, 'Terms & Conditions:', M, y, { font: bold, size: 8 });
    y -= 11;
    text(page, data.invoice.terms.slice(0, 200), M, y, { size: 8 });
    y -= 14;
  }

  // Signatory
  text(page, `For ${data.company.name}`, A4.w - M - 160, M + 40, { size: 9 });
  text(page, 'Authorised Signatory', A4.w - M - 160, M + 12, { size: 9 });

  return doc.save();
}
