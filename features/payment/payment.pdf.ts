import 'server-only';

/**
 * Payment receipt PDF (spec §230). A4 portrait: company header, receipt meta,
 * received-from block, an amount box, invoice settlement summary, amount in
 * words, and an authorised signatory. Receipts are always regenerated from
 * stored data (§237) — this function is pure and stateless.
 *
 * pdf-lib gotcha: StandardFonts (Helvetica) is WinAnsi-only — the ₹ glyph is
 * absent, so money uses "Rs." and all dynamic text is sanitised to Latin-1.
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { rupeesInWords } from '@/utils/number-to-words';

export interface ReceiptPdfData {
  company: { name: string; gstin: string; address: string; phone: string; email: string };
  payment: {
    number: string;
    date: string;
    method: string;
    referenceNumber: string | null;
    amount: number;
    remarks: string | null;
    receivedBy: string;
  };
  invoice: {
    number: string;
    grandTotal: number;
    amountPaid: number;
    balanceDue: number;
  };
  customer: {
    name: string;
    company: string | null;
    address: string | null;
    gstin: string | null;
    phone: string | null;
  };
}

const A4 = { w: 595.28, h: 841.89 };
const M = 40;
const INR = (n: number) =>
  `Rs. ${n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;

export async function generateReceiptPdf(data: ReceiptPdfData): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const text = (
    p: PDFPage,
    s: string,
    x: number,
    yy: number,
    opts: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) => {
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
  text(page, 'PAYMENT RECEIPT', A4.w - M - 150, y, { size: 14, font: bold });
  y -= 16;
  text(page, data.company.address, M, y, { size: 8 });
  y -= 11;
  text(page, `GSTIN: ${data.company.gstin || '—'}`, M, y, { size: 8 });
  text(page, `${data.company.phone}  ${data.company.email}`, M, y - 11, { size: 8 });
  y -= 24;
  line(page, M, y, A4.w - M);
  y -= 16;

  // Receipt meta + received from (two columns)
  const colR = A4.w / 2 + 10;
  text(page, 'Received From', M, y, { font: bold, size: 9 });
  text(page, 'Receipt details', colR, y, { font: bold, size: 9 });
  y -= 13;
  const from = [
    data.customer.company ?? data.customer.name,
    data.customer.company ? data.customer.name : '',
    data.customer.address ?? '',
    data.customer.gstin ? `GSTIN: ${data.customer.gstin}` : '',
    data.customer.phone ?? '',
  ].filter(Boolean);
  const meta = [
    `Receipt / Payment #: ${data.payment.number}`,
    `Date: ${data.payment.date}`,
    `Against Invoice: ${data.invoice.number}`,
    `Method: ${data.payment.method}`,
    data.payment.referenceNumber ? `Reference: ${data.payment.referenceNumber}` : '',
    `Received by: ${data.payment.receivedBy}`,
  ].filter(Boolean);
  const rowsCount = Math.max(from.length, meta.length);
  for (let i = 0; i < rowsCount; i++) {
    if (from[i]) text(page, from[i]!, M, y - i * 11, { size: 8 });
    if (meta[i]) text(page, meta[i]!, colR, y - i * 11, { size: 8 });
  }
  y -= rowsCount * 11 + 18;

  // Amount received box
  const boxH = 44;
  page.drawRectangle({
    x: M,
    y: y - boxH,
    width: A4.w - 2 * M,
    height: boxH,
    borderColor: rgb(0.8, 0.8, 0.8),
    borderWidth: 0.75,
    color: rgb(0.96, 0.98, 0.96),
  });
  text(page, 'Amount Received', M + 14, y - 18, { size: 9, font: bold });
  text(page, INR(data.payment.amount), A4.w - M - 160, y - 22, { size: 16, font: bold, color: [0.1, 0.45, 0.2] });
  text(page, `(${data.payment.method})`, M + 14, y - 33, { size: 8 });
  y -= boxH + 18;

  text(page, `Amount in words: ${rupeesInWords(data.payment.amount)}`, M, y, { size: 8, font: bold });
  y -= 22;

  // Invoice settlement summary (right aligned block)
  const tx = 360;
  const summary: [string, string][] = [
    ['Invoice total', INR(data.invoice.grandTotal)],
    ['Total paid to date', INR(data.invoice.amountPaid)],
    ['Outstanding after payment', INR(data.invoice.balanceDue)],
  ];
  text(page, 'Invoice settlement', tx, y, { font: bold, size: 9 });
  y -= 15;
  for (const [label, val] of summary) {
    text(page, label, tx, y, { size: 9 });
    text(page, val, A4.w - M - 90, y, { size: 9 });
    y -= 13;
  }
  y -= 8;

  if (data.payment.remarks) {
    text(page, 'Remarks:', M, y, { font: bold, size: 8 });
    text(page, data.payment.remarks.slice(0, 160), M + 44, y, { size: 8 });
    y -= 16;
  }

  // Signatory
  text(page, `For ${data.company.name}`, A4.w - M - 160, M + 40, { size: 9 });
  text(page, 'Authorised Signatory', A4.w - M - 160, M + 12, { size: 9 });
  text(page, 'This is a computer-generated receipt.', M, M + 12, { size: 7, color: [0.5, 0.5, 0.5] });

  return doc.save();
}
