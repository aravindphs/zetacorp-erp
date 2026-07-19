/**
 * Invoice financial engine (spec §201, §202). PURE and server-authoritative —
 * the client never sends totals. Calculation order: line base → item discounts
 * → overall discount (distributed proportionally) → per-line GST → CGST/SGST or
 * IGST by place of supply → round off → grand total.
 *
 * Money is computed in paise-safe 2-decimal rounding.
 */
export interface CalcLineInput {
  quantity: number;
  unitPrice: number;
  discount: number; // per-line discount amount
  gstPercentage: number;
}

export interface CalcLineResult extends CalcLineInput {
  taxableValue: number;
  gstAmount: number;
  lineTotal: number;
}

export interface InvoiceTotals {
  lines: CalcLineResult[];
  subtotal: number;
  totalDiscount: number;
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
}

const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;

export function calculateInvoice(params: {
  lines: CalcLineInput[];
  overallDiscount?: number;
  companyState?: string | null;
  placeOfSupply?: string | null;
}): InvoiceTotals {
  const overallDiscount = Math.max(0, params.overallDiscount ?? 0);

  const bases = params.lines.map((l) => Math.max(0, l.quantity * l.unitPrice - (l.discount || 0)));
  const subtotal = r2(params.lines.reduce((s, l) => s + l.quantity * l.unitPrice, 0));
  const itemDiscount = params.lines.reduce((s, l) => s + (l.discount || 0), 0);
  const baseTotal = bases.reduce((s, b) => s + b, 0);

  // Distribute the overall discount proportionally across lines.
  const factor = baseTotal > 0 ? Math.max(0, (baseTotal - overallDiscount) / baseTotal) : 1;

  const lines: CalcLineResult[] = params.lines.map((l, i) => {
    const taxableValue = r2((bases[i] ?? 0) * factor);
    const gstAmount = r2((taxableValue * l.gstPercentage) / 100);
    return {
      ...l,
      taxableValue,
      gstAmount,
      lineTotal: r2(taxableValue + gstAmount),
    };
  });

  const taxableAmount = r2(lines.reduce((s, l) => s + l.taxableValue, 0));
  const gstAmount = r2(lines.reduce((s, l) => s + l.gstAmount, 0));

  // Intra-state (company state == place of supply, or unknown) → CGST + SGST.
  // Inter-state → IGST.
  const company = params.companyState?.trim().toLowerCase();
  const supply = params.placeOfSupply?.trim().toLowerCase();
  const isInterState = Boolean(company && supply && company !== supply);

  const cgstAmount = isInterState ? 0 : r2(gstAmount / 2);
  const sgstAmount = isInterState ? 0 : r2(gstAmount - cgstAmount);
  const igstAmount = isInterState ? gstAmount : 0;

  const preRound = taxableAmount + gstAmount;
  const grandTotal = Math.round(preRound);
  const roundOff = r2(grandTotal - preRound);

  return {
    lines,
    subtotal,
    totalDiscount: r2(itemDiscount + overallDiscount),
    taxableAmount,
    cgstAmount,
    sgstAmount,
    igstAmount,
    gstAmount,
    roundOff,
    grandTotal,
    isInterState,
  };
}

/** Derive payment status from paid amount, total, and due date (spec §204). */
export function derivePaymentStatus(
  grandTotal: number,
  amountPaid: number,
  dueDate: Date | null,
): 'UNPAID' | 'PARTIAL' | 'PAID' | 'OVERDUE' {
  if (amountPaid >= grandTotal && grandTotal > 0) return 'PAID';
  const outstanding = grandTotal - amountPaid;
  if (dueDate && outstanding > 0 && dueDate.getTime() < Date.now()) return 'OVERDUE';
  if (amountPaid > 0) return 'PARTIAL';
  return 'UNPAID';
}
