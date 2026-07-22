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

// ---------------------------------------------------------------------------
// Contract-value billing: 70/30 goods+service split, and materials-only.
//
// Solar EPC work is billed as one agreed contract value that is GST-INCLUSIVE.
// A fixed share (70% by default) is treated as supply of goods (HSN 8541 @5%)
// and the remainder as supply of services (SAC 9954 @18%), so the taxable value
// must be BACK-CALCULATED from the agreed price:
//
//   taxable = contractValue / (goodsShare×(1+goodsRate) + serviceShare×(1+svcRate))
//
// Worked example — 3,20,000 inclusive, 70/30, 5% / 18%:
//   divisor = 0.7×1.05 + 0.3×1.18 = 1.089
//   taxable = 3,20,000 / 1.089 = 2,93,847.57
//   goods   = 2,05,693.30 @5%  → 10,284.66 GST
//   service =   88,154.27 @18% → 15,867.77 GST
//   grand   = 3,20,000.00 exactly
// ---------------------------------------------------------------------------

export type InvoiceBillingType = 'ITEMIZED' | 'SPLIT' | 'MATERIALS_ONLY';

export interface ContractComponent {
  /** 'goods' | 'service' — drives which HSN/SAC and description is printed. */
  kind: 'goods' | 'service';
  sharePercentage: number;
  gstPercentage: number;
  taxableValue: number;
  gstAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
}

export interface ContractTotals {
  components: ContractComponent[];
  taxableAmount: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  gstAmount: number;
  roundOff: number;
  grandTotal: number;
  isInterState: boolean;
}

/**
 * Round half to even ("banker's rounding"), which is what the reference tax
 * invoice uses: goods GST of 10,284.665 becomes 10,284.66, not 10,284.67.
 * Ties are detected with an epsilon because binary floats cannot represent
 * .5 exactly at these magnitudes.
 */
function bankersRound(value: number): number {
  const floor = Math.floor(value);
  const fraction = value - floor;
  if (Math.abs(fraction - 0.5) < 1e-9) {
    return floor % 2 === 0 ? floor : floor + 1;
  }
  return Math.round(value);
}

/**
 * GST for one component, computed in integer paise so no rounding drift can
 * accumulate. CGST takes the (banker's-rounded) half and SGST takes the
 * remainder, so the two always re-sum to the total exactly — this is why the
 * reference shows 15,867.77 split as 7,933.88 + 7,933.89.
 */
function componentTax(taxablePaise: number, ratePercent: number, isInterState: boolean) {
  const gstPaise = bankersRound((taxablePaise * ratePercent) / 100);
  if (isInterState) {
    return { gstPaise, cgstPaise: 0, sgstPaise: 0, igstPaise: gstPaise };
  }
  const cgstPaise = bankersRound(gstPaise / 2);
  return { gstPaise, cgstPaise, sgstPaise: gstPaise - cgstPaise, igstPaise: 0 };
}

export function calculateContractInvoice(params: {
  /** The agreed contract value. */
  contractValue: number;
  /** True when `contractValue` already includes GST (the normal case). */
  isTaxInclusive: boolean;
  billingType: 'SPLIT' | 'MATERIALS_ONLY';
  /** Goods share for SPLIT, e.g. 70. Ignored for MATERIALS_ONLY (always 100). */
  goodsRatio: number;
  goodsGstPercentage: number;
  serviceGstPercentage: number;
  companyState?: string | null;
  placeOfSupply?: string | null;
}): ContractTotals {
  const company = params.companyState?.trim().toLowerCase();
  const supply = params.placeOfSupply?.trim().toLowerCase();
  const isInterState = Boolean(company && supply && company !== supply);

  const contractValue = Math.max(0, params.contractValue);
  const isSplit = params.billingType === 'SPLIT';

  // Shares as fractions. Materials-only is a single 100% goods component.
  const goodsShare = isSplit ? Math.min(100, Math.max(0, params.goodsRatio)) / 100 : 1;
  const serviceShare = r2(1 - goodsShare);

  const goodsRate = Math.max(0, params.goodsGstPercentage) / 100;
  const serviceRate = Math.max(0, params.serviceGstPercentage) / 100;

  // Back-calculate the pre-tax total from the inclusive price.
  const divisor = goodsShare * (1 + goodsRate) + serviceShare * (1 + serviceRate);
  const taxableTotalRaw = params.isTaxInclusive
    ? (divisor > 0 ? contractValue / divisor : 0)
    : contractValue;

  const specs: { kind: 'goods' | 'service'; share: number; rate: number }[] = [
    { kind: 'goods', share: goodsShare, rate: goodsRate },
    ...(isSplit && serviceShare > 0
      ? [{ kind: 'service' as const, share: serviceShare, rate: serviceRate }]
      : []),
  ];

  const components: ContractComponent[] = specs.map((s) => {
    // Work in integer paise from here so halves and sums stay exact.
    const taxablePaise = Math.round(taxableTotalRaw * s.share * 100);
    const { gstPaise, cgstPaise, sgstPaise, igstPaise } = componentTax(
      taxablePaise,
      s.rate * 100,
      isInterState,
    );
    return {
      kind: s.kind,
      sharePercentage: r2(s.share * 100),
      gstPercentage: r2(s.rate * 100),
      taxableValue: taxablePaise / 100,
      gstAmount: gstPaise / 100,
      cgstAmount: cgstPaise / 100,
      sgstAmount: sgstPaise / 100,
      igstAmount: igstPaise / 100,
      lineTotal: (taxablePaise + gstPaise) / 100,
    };
  });

  const taxableAmount = r2(components.reduce((s, c) => s + c.taxableValue, 0));
  const gstAmount = r2(components.reduce((s, c) => s + c.gstAmount, 0));
  const cgstAmount = r2(components.reduce((s, c) => s + c.cgstAmount, 0));
  const sgstAmount = r2(components.reduce((s, c) => s + c.sgstAmount, 0));
  const igstAmount = r2(components.reduce((s, c) => s + c.igstAmount, 0));

  const preRound = r2(taxableAmount + gstAmount);
  // For an inclusive contract the customer-facing total is the agreed figure,
  // so any sub-paisa drift from the back-calculation lands in round-off.
  const grandTotal = params.isTaxInclusive ? r2(contractValue) : Math.round(preRound);
  const roundOff = r2(grandTotal - preRound);

  return {
    components,
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
