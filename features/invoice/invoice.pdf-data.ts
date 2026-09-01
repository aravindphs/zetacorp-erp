import 'server-only';

/**
 * Maps a stored invoice/quotation onto the PDF row model, so contract-billed
 * and itemized documents render through the same template.
 */
import type { InvoicePdfRow } from '@/features/invoice/invoice.pdf';
import { calculateContractInvoice } from '@/features/invoice/invoice.calc';

/** Template defaults (§304-style boilerplate); each is editable per invoice. */
export const CONTRACT_DEFAULTS = {
  goodsHsnCode: '8541',
  serviceSacCode: '9954',
  goodsGstPercentage: 5,
  serviceGstPercentage: 18,
  goodsRatio: 70,
  goodsDescription: 'Supply of Solar Power Generating System equipment',
  serviceDescription: 'Installation, erection & commissioning services',
} as const;

/** The four standard notes, with the live figures substituted. */
export function defaultInvoiceNotes(params: {
  goodsRatio: number;
  serviceRatio: number;
  goodsGst: number;
  serviceGst: number;
  goodsHsn: string;
  serviceSac: string;
  grandTotal: number;
  isInterState: boolean;
  placeOfSupply?: string | null;
}): string {
  const money = params.grandTotal.toLocaleString('en-IN', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  const taxNote = params.isInterState
    ? `Tax is charged as IGST since the place of supply${params.placeOfSupply ? ` (${params.placeOfSupply})` : ''} is outside the supplier's state.`
    : `Tax is charged as CGST + SGST since the place of supply${params.placeOfSupply ? ` (${params.placeOfSupply})` : ''} is in the same state as the supplier's registered place of business.`;

  return [
    `This invoice is prepared in line with the GST treatment applicable to solar power generating systems, under which ${params.goodsRatio}% of the total contract value is treated as supply of goods (HSN ${params.goodsHsn}, taxed at ${params.goodsGst}%) and the remaining ${params.serviceRatio}% is treated as supply of services (SAC ${params.serviceSac}, taxed at ${params.serviceGst}%).`,
    `Total invoice value of Rs. ${money} is inclusive of GST as agreed with the customer.`,
    taxNote,
    'This is a system-generated tax invoice.',
  ].join('\n');
}

/** "5% (2.5+2.5)" intra-state, "5% (IGST)" inter-state. */
function rateLabel(rate: number, isInterState: boolean): string {
  if (isInterState) return `${rate}% (IGST)`;
  const half = rate / 2;
  const fmt = (n: number) => (Number.isInteger(n) ? String(n) : n.toFixed(1));
  return `${rate}% (${fmt(half)}+${fmt(half)})`;
}

interface ContractSource {
  billingType: string;
  isTaxInclusive: boolean;
  contractValue: { toNumber(): number } | null;
  goodsRatio: { toNumber(): number };
  goodsGstPercentage: { toNumber(): number };
  serviceGstPercentage: { toNumber(): number };
  goodsHsnCode: string | null;
  serviceSacCode: string | null;
  goodsDescription: string | null;
  serviceDescription: string | null;
}

interface ItemSource {
  productName: string;
  hsnCode: string | null;
  taxableValue: { toNumber(): number };
  gstPercentage: { toNumber(): number };
  gstAmount: { toNumber(): number };
  lineTotal: { toNumber(): number };
}

/**
 * Render one product line as a PDF row. Intra-state CGST/SGST are each taken at
 * HALF the rate so they are always equal (matching the calc engine), rather
 * than halving the combined GST and leaving an odd paisa on one side.
 */
function itemToRow(item: ItemSource, isInterState: boolean): InvoicePdfRow {
  const taxable = item.taxableValue.toNumber();
  const rate = item.gstPercentage.toNumber();
  const half = Math.round(((taxable * rate) / 200) * 100) / 100;
  return {
    description: item.productName,
    hsn: item.hsnCode ?? '',
    taxable,
    gstRateLabel: rateLabel(rate, isInterState),
    cgst: isInterState ? 0 : half,
    sgst: isInterState ? 0 : half,
    igst: isInterState ? item.gstAmount.toNumber() : 0,
    total: item.lineTotal.toNumber(),
  };
}

/**
 * Rebuild the printed rows. Contract invoices are recomputed from the stored
 * ratio and rates so the PDF always reconciles with the saved totals.
 */
export function buildPdfRows(
  invoice: ContractSource,
  items: ItemSource[],
  isInterState: boolean,
): InvoicePdfRow[] {
  if (invoice.billingType === 'ITEMIZED') {
    return items.map((item) => itemToRow(item, isInterState));
  }

  const goodsRatio = invoice.goodsRatio.toNumber();
  const serviceRatio = Math.round((100 - goodsRatio) * 100) / 100;
  const isSplit = invoice.billingType === 'SPLIT';
  const goodsRate = invoice.goodsGstPercentage.toNumber();
  const serviceRate = invoice.serviceGstPercentage.toNumber();

  // Recompute the contract split from its own inputs rather than from the
  // stored totals, which also include any additional product lines.
  const contract = calculateContractInvoice({
    contractValue: invoice.contractValue?.toNumber() ?? 0,
    isTaxInclusive: invoice.isTaxInclusive,
    billingType: isSplit ? 'SPLIT' : 'MATERIALS_ONLY',
    goodsRatio,
    goodsGstPercentage: goodsRate,
    serviceGstPercentage: serviceRate,
    // The caller already resolved jurisdiction; mirror it exactly.
    companyState: isInterState ? 'a' : 'a',
    placeOfSupply: isInterState ? 'b' : 'a',
  });

  const goodsPart = contract.components[0];
  const servicePart = contract.components[1];
  const goodsTaxable = goodsPart?.taxableValue ?? 0;
  const serviceTaxable = servicePart?.taxableValue ?? 0;

  const rows: InvoicePdfRow[] = [
    {
      description: invoice.goodsDescription ?? CONTRACT_DEFAULTS.goodsDescription,
      subNote: isSplit
        ? `(${goodsRatio}% of contract value treated as goods as per applicable GST classification for solar power generating systems)`
        : null,
      hsn: invoice.goodsHsnCode ?? CONTRACT_DEFAULTS.goodsHsnCode,
      taxable: goodsTaxable,
      gstRateLabel: rateLabel(goodsRate, isInterState),
      cgst: goodsPart?.cgstAmount ?? 0,
      sgst: goodsPart?.sgstAmount ?? 0,
      igst: goodsPart?.igstAmount ?? 0,
      total: goodsPart?.lineTotal ?? 0,
    },
  ];

  // Additional products billed alongside the contract (billed on top).
  const extraRows: InvoicePdfRow[] = items.map((item) => itemToRow(item, isInterState));

  if (isSplit && servicePart && serviceTaxable > 0) {
    rows.push({
      description: invoice.serviceDescription ?? CONTRACT_DEFAULTS.serviceDescription,
      subNote: `(${serviceRatio}% of contract value treated as service)`,
      hsn: invoice.serviceSacCode ?? CONTRACT_DEFAULTS.serviceSacCode,
      taxable: serviceTaxable,
      gstRateLabel: rateLabel(serviceRate, isInterState),
      cgst: servicePart.cgstAmount,
      sgst: servicePart.sgstAmount,
      igst: servicePart.igstAmount,
      total: servicePart.lineTotal,
    });
  }

  return [...rows, ...extraRows];
}
