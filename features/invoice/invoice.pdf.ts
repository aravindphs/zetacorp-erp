import 'server-only';

/**
 * Tax invoice / quotation PDF (spec §207, §208), matching the NSquare tax
 * invoice template: navy header rules, a navy table header band, a boxed
 * "Bill To" panel, a right-aligned totals block and a numbered notes section.
 *
 * Two row shapes are supported by the same design:
 *   • contract billing — one row for goods and (for SPLIT) one for services,
 *     each with its own HSN/SAC and GST rate;
 *   • itemized billing — one row per product line.
 *
 * pdf-lib gotcha: StandardFonts (Helvetica) is WinAnsi-only, so `₹` and other
 * non-Latin-1 characters are replaced — money is rendered as "Rs.".
 */
import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from 'pdf-lib';
import { rupeesInWords } from '@/utils/number-to-words';

/** Template palette. */
const NAVY: [number, number, number] = [0.122, 0.306, 0.475]; // #1F4E79
const INK: [number, number, number] = [0.1, 0.1, 0.1];
const MUTED: [number, number, number] = [0.35, 0.35, 0.35];
const RULE: [number, number, number] = [0.75, 0.75, 0.75];
const PANEL: [number, number, number] = [0.957, 0.957, 0.957]; // #F4F4F4

export interface InvoicePdfRow {
  /** Printed description; supports a smaller parenthetical second line. */
  description: string;
  subNote?: string | null;
  hsn: string;
  taxable: number;
  /** e.g. "5% (2.5+2.5)" — precomposed so split and itemized read alike. */
  gstRateLabel: string;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
}

export interface InvoicePdfData {
  company: {
    name: string;
    gstin: string;
    address: string;
    phone: string;
    email: string;
    state?: string | null;
  };
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
  rows: InvoicePdfRow[];
  totals: {
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
const M = 42;

const INR = (n: number) =>
  n.toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** Split text to fit a column width, so long descriptions wrap instead of clip. */
function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const words = (text ?? '').split(/\s+/).filter(Boolean);
  const lines: string[] = [];
  let current = '';
  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (font.widthOfTextAtSize(candidate, size) <= maxWidth) current = candidate;
    else {
      if (current) lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines.length > 0 ? lines : [''];
}

export async function generateInvoicePdf(
  data: InvoicePdfData,
  title = 'TAX INVOICE',
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const font = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  let page = doc.addPage([A4.w, A4.h]);
  let y = A4.h - M;

  const safe = (s: string) => (s ?? '').replace(/[^\x00-\xFF]/g, '?');

  const text = (
    s: string,
    x: number,
    yy: number,
    o: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) =>
    page.drawText(safe(s), {
      x,
      y: yy,
      size: o.size ?? 9,
      font: o.font ?? font,
      color: rgb(...(o.color ?? INK)),
    });

  const textRight = (
    s: string,
    xRight: number,
    yy: number,
    o: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) => {
    const f = o.font ?? font;
    const size = o.size ?? 9;
    text(s, xRight - f.widthOfTextAtSize(safe(s), size), yy, o);
  };

  const textCenter = (
    s: string,
    yy: number,
    o: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) => {
    const f = o.font ?? font;
    const size = o.size ?? 9;
    text(s, (A4.w - f.widthOfTextAtSize(safe(s), size)) / 2, yy, o);
  };

  const rule = (yy: number, color = RULE, thickness = 0.75) =>
    page.drawLine({
      start: { x: M, y: yy },
      end: { x: A4.w - M, y: yy },
      thickness,
      color: rgb(...color),
    });

  // --- Company header ------------------------------------------------------
  textCenter(data.company.name.toUpperCase(), y, { size: 15, font: bold, color: NAVY });
  y -= 13;
  if (data.company.address) {
    textCenter(data.company.address, y, { size: 8, color: MUTED });
    y -= 11;
  }
  const gstLine = [
    data.company.gstin ? `GSTIN: ${data.company.gstin}` : '',
    data.company.state ? `State: ${data.company.state}` : '',
  ]
    .filter(Boolean)
    .join('  |  ');
  if (gstLine) {
    textCenter(gstLine, y, { size: 8, color: MUTED });
    y -= 11;
  }
  y -= 4;
  rule(y, NAVY, 1.5);
  y -= 26;

  // --- Title ---------------------------------------------------------------
  textCenter(title, y, { size: 17, font: bold });
  y -= 28;

  // --- Invoice meta (two columns) -----------------------------------------
  const labelX = M + 4;
  const valueX = M + 96;
  const rLabelX = A4.w / 2 + 24;
  const rValueX = A4.w / 2 + 118;

  const metaRow = (l1: string, v1: string, l2: string, v2: string) => {
    text(l1, labelX, y, { size: 9, font: bold });
    text(v1, valueX, y, { size: 9 });
    if (l2) {
      text(l2, rLabelX, y, { size: 9, font: bold });
      text(v2, rValueX, y, { size: 9 });
    }
    y -= 15;
  };

  metaRow('Invoice No:', data.invoice.number, 'Invoice Date:', data.invoice.date);
  metaRow(
    'Place of Supply:',
    data.invoice.placeOfSupply ?? '-',
    'Reverse Charge:',
    data.invoice.reverseCharge ? 'Yes' : 'No',
  );
  if (data.invoice.dueDate || data.invoice.referenceNumber) {
    metaRow(
      'Due Date:',
      data.invoice.dueDate ?? '-',
      data.invoice.referenceNumber ? 'Reference:' : '',
      data.invoice.referenceNumber ?? '',
    );
  }
  y -= 6;

  // --- Bill To panel -------------------------------------------------------
  // Treat blank strings as absent: `??` alone would let an empty companyName
  // blank out the first line and drop the customer name entirely.
  const custCompany = data.customer.company?.trim() || null;
  const custName = data.customer.name?.trim() || null;
  const custAddress = data.customer.address?.trim() || null;

  const billLines = [
    custCompany ?? custName ?? 'Customer',
    custCompany && custName ? custName : '',
    custAddress ?? '',
    data.customer.gstin?.trim()
      ? `GSTIN: ${data.customer.gstin.trim()}`
      : 'GSTIN: Unregistered (B2C)',
    data.customer.phone?.trim() ?? '',
  ].filter(Boolean);

  const panelH = 22 + billLines.length * 11;
  page.drawRectangle({
    x: M,
    y: y - panelH,
    width: A4.w - 2 * M,
    height: panelH,
    color: rgb(...PANEL),
    borderColor: rgb(...RULE),
    borderWidth: 0.75,
  });
  text('Bill To / Site Address:', M + 10, y - 14, { size: 9, font: bold });
  billLines.forEach((line, i) => text(line, M + 10, y - 27 - i * 11, { size: 8.5 }));
  y -= panelH + 20;

  // --- Item table ----------------------------------------------------------
  // Columns are laid out right-to-left from the page margin so the money
  // columns stay aligned regardless of the description width.
  // Column bands are laid out edge-to-edge across the printable width so the
  // money columns never collide with long descriptions. Header labels wrap onto
  // two lines, as in the reference template.
  const xEnd = A4.w - M;
  const PAD = 4;
  const band = data.isInterState
    ? { sno: 18, desc: 190, hsn: 40, taxable: 74, rate: 58, tax1: 0, tax2: 66, total: 65 }
    : { sno: 18, desc: 165, hsn: 38, taxable: 68, rate: 52, tax1: 55, tax2: 55, total: 60 };

  const xSno = M;
  const xDesc = xSno + band.sno;
  const xHsn = xDesc + band.desc;
  const xTaxable = xHsn + band.hsn;
  const xRate = xTaxable + band.taxable;
  const xTax1 = xRate + band.rate;
  const xTax2 = xTax1 + band.tax1;
  const xTotal = xTax2 + band.tax2;

  const rTaxable = xRate - PAD;
  const rTax1 = xTax2 - PAD;
  const rTax2 = xTotal - PAD;
  const rTotal = xEnd - PAD;
  const descWidth = band.desc - 2 * PAD;

  /** Centre a string within a band. */
  const textCentered = (
    s: string,
    left: number,
    width: number,
    yy: number,
    o: { size?: number; font?: PDFFont; color?: [number, number, number] } = {},
  ) => {
    const f = o.font ?? font;
    const size = o.size ?? 9;
    text(s, left + (width - f.widthOfTextAtSize(safe(s), size)) / 2, yy, o);
  };

  const HEADER_H = 28;
  const drawTableHeader = () => {
    page.drawRectangle({
      x: M,
      y: y - HEADER_H,
      width: A4.w - 2 * M,
      height: HEADER_H,
      color: rgb(...NAVY),
    });
    const white: [number, number, number] = [1, 1, 1];
    const h1 = y - 11; // first header line
    const h2 = y - 21; // second header line
    const hOpts = { size: 7.5, font: bold, color: white };

    textCentered('#', xSno, band.sno, h1, hOpts);
    text('Description', xDesc + PAD, h1, hOpts);
    textCentered('HSN/', xHsn, band.hsn, h1, hOpts);
    textCentered('SAC', xHsn, band.hsn, h2, hOpts);
    textRight('Taxable', rTaxable, h1, hOpts);
    textRight('Value (Rs.)', rTaxable, h2, hOpts);
    textCentered('GST', xRate, band.rate, h1, hOpts);
    textCentered('Rate', xRate, band.rate, h2, hOpts);
    if (data.isInterState) {
      textRight('IGST', rTax2, h1, hOpts);
      textRight('(Rs.)', rTax2, h2, hOpts);
    } else {
      textRight('CGST', rTax1, h1, hOpts);
      textRight('(Rs.)', rTax1, h2, hOpts);
      textRight('SGST', rTax2, h1, hOpts);
      textRight('(Rs.)', rTax2, h2, hOpts);
    }
    textRight('Total', rTotal, h1, hOpts);
    textRight('(Rs.)', rTotal, h2, hOpts);
    y -= HEADER_H;
  };

  drawTableHeader();

  data.rows.forEach((row, i) => {
    const descLines = wrap(row.description, font, 8.5, descWidth);
    const noteLines = row.subNote ? wrap(row.subNote, font, 7, descWidth) : [];
    const rowH = Math.max(30, 12 + descLines.length * 11 + noteLines.length * 9);

    // Page break before a row that would overflow.
    if (y - rowH < M + 150) {
      page = doc.addPage([A4.w, A4.h]);
      y = A4.h - M;
      drawTableHeader();
    }

    const top = y;
    const bottom = y - rowH;
    // Vertically centre the numeric cells against the description block.
    const midY = top - rowH / 2 - 3;

    textCentered(String(i + 1), xSno, band.sno, midY, { size: 8.5 });
    descLines.forEach((line, li) => text(line, xDesc + PAD, top - 14 - li * 11, { size: 8.5 }));
    noteLines.forEach((line, li) =>
      text(line, xDesc + PAD, top - 16 - descLines.length * 11 - li * 9, {
        size: 7,
        color: MUTED,
      }),
    );
    textCentered(row.hsn || '-', xHsn, band.hsn, midY, { size: 8.5 });
    textRight(INR(row.taxable), rTaxable, midY, { size: 8.5 });
    textCentered(row.gstRateLabel, xRate, band.rate, midY, { size: 7.5 });
    if (data.isInterState) {
      textRight(INR(row.igst), rTax2, midY, { size: 8.5 });
    } else {
      textRight(INR(row.cgst), rTax1, midY, { size: 8.5 });
      textRight(INR(row.sgst), rTax2, midY, { size: 8.5 });
    }
    textRight(INR(row.total), rTotal, midY, { size: 8.5 });

    page.drawLine({
      start: { x: M, y: bottom },
      end: { x: xEnd, y: bottom },
      thickness: 0.5,
      color: rgb(...RULE),
    });
    y = bottom;
  });

  // Table total band.
  page.drawRectangle({
    x: M,
    y: y - 22,
    width: A4.w - 2 * M,
    height: 22,
    color: rgb(...PANEL),
  });
  const ty = y - 15;
  text('Total', xDesc + PAD, ty, { size: 9, font: bold });
  textRight(INR(data.totals.taxable), rTaxable, ty, { size: 9, font: bold });
  if (data.isInterState) {
    textRight(INR(data.totals.igst), rTax2, ty, { size: 9, font: bold });
  } else {
    textRight(INR(data.totals.cgst), rTax1, ty, { size: 9, font: bold });
    textRight(INR(data.totals.sgst), rTax2, ty, { size: 9, font: bold });
  }
  textRight(INR(data.totals.grandTotal), rTotal, ty, { size: 9, font: bold });
  y -= 22;
  rule(y, RULE, 0.75);
  y -= 24;

  // --- Amount in words -----------------------------------------------------
  // The shared helper renders "<words> Rupees Only"; the template phrases it
  // "Rupees <words> Only".
  const words = rupeesInWords(data.totals.grandTotal).replace(
    /^(.*?)\s+Rupees\s+Only$/i,
    'Rupees $1 Only',
  );
  text(`Amount in Words: ${words}`, M, y, { size: 9, font: bold });
  y -= 24;

  // --- Totals summary (right aligned) --------------------------------------
  const sumLabelX = A4.w / 2 - 20;
  const summary: [string, string][] = [
    ['Total Taxable Value', `Rs. ${INR(data.totals.taxable)}`],
    ...(data.isInterState
      ? ([['Total IGST', `Rs. ${INR(data.totals.igst)}`]] as [string, string][])
      : ([
          ['Total CGST', `Rs. ${INR(data.totals.cgst)}`],
          ['Total SGST', `Rs. ${INR(data.totals.sgst)}`],
        ] as [string, string][])),
    ...(data.totals.roundOff !== 0
      ? ([['Round Off', `Rs. ${INR(data.totals.roundOff)}`]] as [string, string][])
      : []),
  ];
  for (const [label, value] of summary) {
    text(label, sumLabelX, y, { size: 9 });
    textRight(value, xEnd - 4, y, { size: 9 });
    y -= 15;
  }
  page.drawLine({
    start: { x: sumLabelX, y: y + 5 },
    end: { x: xEnd - 4, y: y + 5 },
    thickness: 0.75,
    color: rgb(...RULE),
  });
  y -= 10;
  text('Grand Total (Round Off)', sumLabelX, y, { size: 10, font: bold });
  textRight(`Rs. ${INR(data.totals.grandTotal)}`, xEnd - 4, y, { size: 10, font: bold });
  y -= 26;

  // --- Notes ---------------------------------------------------------------
  const noteSource = data.invoice.notes ?? data.invoice.terms;
  if (noteSource) {
    const notes = noteSource
      .split('\n')
      .map((n) => n.trim())
      .filter(Boolean);
    if (notes.length > 0) {
      rule(y + 8, RULE, 0.75);
      text('Notes:', M, y, { size: 9, font: bold });
      y -= 13;
      notes.forEach((note, i) => {
        // Strip a leading "1." so pre-numbered text is not numbered twice.
        const clean = note.replace(/^\d+[.)]\s*/, '');
        const lines = wrap(`${i + 1}. ${clean}`, font, 7.5, A4.w - 2 * M);
        lines.forEach((line) => {
          text(line, M, y, { size: 7.5, color: MUTED });
          y -= 10;
        });
      });
      y -= 8;
    }
  }

  // --- Signatory -----------------------------------------------------------
  const signY = Math.max(y, M + 60);
  textRight(`For ${data.company.name.toUpperCase()}`, xEnd - 4, signY, { size: 9, font: bold });
  textRight('Authorised Signatory', xEnd - 4, signY - 42, { size: 9 });

  return doc.save();
}
