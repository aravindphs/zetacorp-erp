'use client';

/**
 * Create invoice form (spec §196–§201). Dynamic line items with a product
 * picker and a LIVE totals preview computed by the shared calc engine. The
 * server recomputes all money authoritatively on submit.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/utils/format';
import { calculateContractInvoice, calculateInvoice } from '@/features/invoice/invoice.calc';
import { createInvoiceAction } from '@/features/invoice/invoice.actions';
import { ProductPicker, type PickerProduct } from '@/features/invoice/components/product-picker';
import { LineCell } from '@/components/shared/line-cell';

type BillingType = 'ITEMIZED' | 'SPLIT' | 'MATERIALS_ONLY';

const BILLING_TYPE_LABELS: Record<BillingType, string> = {
  SPLIT: 'Goods + service split (70/30)',
  MATERIALS_ONLY: 'Materials only',
  ITEMIZED: 'Itemized products',
};

interface LineItem {
  key: string;
  productId?: string;
  productName: string;
  hsnCode: string;
  unit: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  gstPercentage: number;
}

let counter = 0;
const newLine = (): LineItem => ({
  key: `l${counter++}`,
  productName: '',
  hsnCode: '',
  unit: 'Nos',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  gstPercentage: 0,
});

export function InvoiceForm({
  customers,
  initialCustomerId,
  canPost,
  companyState,
}: {
  customers: { id: string; code: string; name: string; address?: string }[];
  initialCustomerId?: string;
  canPost: boolean;
  companyState: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  const [invoiceDate, setInvoiceDate] = useState(today);
  const [dueDate, setDueDate] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [reverseCharge, setReverseCharge] = useState(false);
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [notes, setNotes] = useState('');
  const [terms, setTerms] = useState('');
  const [items, setItems] = useState<LineItem[]>([newLine()]);

  // Contract billing (solar EPC). The contract value is GST-inclusive, so the
  // taxable split is back-calculated — see calculateContractInvoice.
  const [billingType, setBillingType] = useState<BillingType>('SPLIT');
  const [contractValue, setContractValue] = useState(0);
  const [isTaxInclusive, setIsTaxInclusive] = useState(true);
  const [goodsRatio, setGoodsRatio] = useState(70);
  const [goodsGst, setGoodsGst] = useState(5);
  const [serviceGst, setServiceGst] = useState(18);
  const [goodsHsn, setGoodsHsn] = useState('8541');
  const [serviceSac, setServiceSac] = useState('9954');
  const [goodsDesc, setGoodsDesc] = useState('');
  const [serviceDesc, setServiceDesc] = useState('');
  const [billingAddress, setBillingAddress] = useState('');

  const isContract = billingType !== 'ITEMIZED';

  const totals = useMemo(() => {
    if (isContract) {
      const contract = calculateContractInvoice({
        contractValue: contractValue || 0,
        isTaxInclusive,
        billingType,
        goodsRatio,
        goodsGstPercentage: goodsGst,
        serviceGstPercentage: serviceGst,
        companyState,
        placeOfSupply,
      });

      // Additional products are billed on top of the contract value. The server
      // does the same in computeTotals — keep this preview in step with it.
      const extras = calculateInvoice({
        lines: items.map((i) => ({
          quantity: i.quantity || 0,
          unitPrice: i.unitPrice || 0,
          discount: i.discount || 0,
          gstPercentage: i.gstPercentage || 0,
        })),
        companyState,
        placeOfSupply,
      });

      const r2 = (n: number) => Math.round((n + Number.EPSILON) * 100) / 100;
      return {
        ...contract,
        taxableAmount: r2(contract.taxableAmount + extras.taxableAmount),
        gstAmount: r2(contract.gstAmount + extras.gstAmount),
        cgstAmount: r2(contract.cgstAmount + extras.cgstAmount),
        sgstAmount: r2(contract.sgstAmount + extras.sgstAmount),
        igstAmount: r2(contract.igstAmount + extras.igstAmount),
        grandTotal: r2(contract.grandTotal + extras.taxableAmount + extras.gstAmount),
      };
    }
    return calculateInvoice({
      lines: items.map((i) => ({
        quantity: i.quantity || 0,
        unitPrice: i.unitPrice || 0,
        discount: i.discount || 0,
        gstPercentage: i.gstPercentage || 0,
      })),
      overallDiscount,
      companyState,
      placeOfSupply,
    });
  }, [
    isContract,
    billingType,
    contractValue,
    isTaxInclusive,
    goodsRatio,
    goodsGst,
    serviceGst,
    items,
    overallDiscount,
    companyState,
    placeOfSupply,
  ]);

  /**
   * Choosing a customer pre-fills the bill-to address from their default
   * address. An address the user has already edited is left alone.
   */
  function selectCustomer(id: string) {
    setCustomerId(id);
    const picked = customers.find((c) => c.id === id);
    const previous = customers.find((c) => c.id === customerId)?.address ?? '';
    if (picked && (!billingAddress.trim() || billingAddress === previous)) {
      setBillingAddress(picked.address ?? '');
    }
  }

  function updateLine(key: string, patch: Partial<LineItem>) {
    setItems((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  }
  function removeLine(key: string) {
    setItems((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  }
  function addProduct(p: PickerProduct) {
    setItems((prev) => [
      ...prev.filter((l) => l.productName || l.unitPrice),
      {
        key: `l${counter++}`,
        productId: p.id,
        productName: p.productName,
        hsnCode: p.hsnCode ?? '',
        unit: p.unit,
        quantity: 1,
        unitPrice: p.sellingPrice,
        discount: 0,
        gstPercentage: p.gstPercentage,
      },
    ]);
  }

  function submit(postNow: boolean) {
    if (!customerId) {
      toast.error('Select a customer.');
      return;
    }
    const validItems = items.filter((l) => l.productName.trim() && l.quantity > 0);
    if (!isContract && validItems.length === 0) {
      toast.error('Add at least one product line.');
      return;
    }
    if (isContract && contractValue <= 0) {
      toast.error('Enter the agreed contract value.');
      return;
    }
    startTransition(async () => {
      const result = await createInvoiceAction({
        customerId,
        invoiceDate,
        dueDate: dueDate || undefined,
        placeOfSupply: placeOfSupply || undefined,
        referenceNumber: referenceNumber || undefined,
        reverseCharge,
        overallDiscount,
        notes: notes || undefined,
        termsConditions: terms || undefined,
        postNow,
        billingType,
        isTaxInclusive,
        contractValue: isContract ? contractValue : undefined,
        goodsRatio,
        goodsGstPercentage: goodsGst,
        serviceGstPercentage: serviceGst,
        goodsHsnCode: goodsHsn || undefined,
        serviceSacCode: serviceSac || undefined,
        goodsDescription: goodsDesc || undefined,
        serviceDescription: serviceDesc || undefined,
        billingAddress: billingAddress || undefined,
        items: isContract
          ? []
          : validItems.map((l) => ({
              productId: l.productId,
              productName: l.productName,
              hsnCode: l.hsnCode || undefined,
              unit: l.unit,
              quantity: l.quantity,
              unitPrice: l.unitPrice,
              discount: l.discount,
              gstPercentage: l.gstPercentage,
            })),
      });
      if (result.success) {
        toast.success(result.message);
        router.push(`/invoices/${result.data.id}`);
        router.refresh();
      } else {
        toast.error(result.message);
        for (const e of result.errors) if (e.message) toast.error(e.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Invoice details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2 sm:col-span-1">
            <Label>Customer *</Label>
            <Select
              items={Object.fromEntries(customers.map((c) => [c.id, `${c.name} (${c.code})`]))}
              value={customerId}
              onValueChange={(v) => selectCustomer(v ?? '')}
            >
              <SelectTrigger>
                <SelectValue placeholder="Select customer" />
              </SelectTrigger>
              <SelectContent>
                {customers.map((c) => (
                  <SelectItem key={c.id} value={c.id}>
                    {c.name} ({c.code})
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="inv-date">Invoice date *</Label>
            <Input id="inv-date" type="date" value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due-date">Due date</Label>
            <Input id="due-date" type="date" value={dueDate} onChange={(e) => setDueDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pos">Place of supply</Label>
            <Input id="pos" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="State" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="ref">Reference #</Label>
            <Input id="ref" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
          <label className="flex items-end gap-2 pb-2 text-sm">
            <Switch checked={reverseCharge} onCheckedChange={setReverseCharge} /> Reverse charge
          </label>
          <div className="space-y-2 sm:col-span-3">
            <Label htmlFor="billaddr">Bill to / site address</Label>
            <Textarea
              id="billaddr"
              rows={2}
              value={billingAddress}
              onChange={(e) => setBillingAddress(e.target.value)}
              placeholder="Street, city, state, postal code"
            />
            <p className="text-xs text-muted-foreground">
              Pre-filled from the customer&apos;s default address. Edit it here to change only what
              this invoice prints.
            </p>
          </div>
        </CardContent>
      </Card>

      {/* Billing type & contract value (solar EPC split billing). */}
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Billing</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Billing type</Label>
            <Select
              items={BILLING_TYPE_LABELS}
              value={billingType}
              onValueChange={(v) => setBillingType((v as BillingType) ?? 'SPLIT')}
            >
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(BILLING_TYPE_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>
                    {l}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          {isContract && (
            <>
              <div className="space-y-2">
                <Label htmlFor="contract">
                  Contract value (₹) <span className="text-destructive">*</span>
                </Label>
                <Input
                  id="contract"
                  type="number"
                  step="0.01"
                  min={0}
                  value={contractValue || ''}
                  onChange={(e) => setContractValue(Number(e.target.value))}
                />
                <p className="text-xs text-muted-foreground">
                  {isTaxInclusive
                    ? 'The agreed price including GST — the taxable value is derived from it.'
                    : 'Pre-tax value; GST will be added on top.'}
                </p>
              </div>

              <label className="flex items-end gap-2 pb-2 text-sm sm:col-span-2">
                <Switch checked={isTaxInclusive} onCheckedChange={setIsTaxInclusive} />
                Contract value includes GST
              </label>

              {billingType === 'SPLIT' && (
                <div className="space-y-2">
                  <Label htmlFor="ratio">Goods share (%)</Label>
                  <Input
                    id="ratio"
                    type="number"
                    step="0.01"
                    min={0}
                    max={100}
                    value={goodsRatio}
                    onChange={(e) => setGoodsRatio(Number(e.target.value))}
                  />
                  <p className="text-xs text-muted-foreground">
                    Service share: {Math.round((100 - goodsRatio) * 100) / 100}%
                  </p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ggst">
                  {billingType === 'SPLIT' ? 'Goods GST (%)' : 'GST (%)'}
                </Label>
                <Input
                  id="ggst"
                  type="number"
                  step="0.01"
                  min={0}
                  max={28}
                  value={goodsGst}
                  onChange={(e) => setGoodsGst(Number(e.target.value))}
                />
              </div>

              {billingType === 'SPLIT' && (
                <div className="space-y-2">
                  <Label htmlFor="sgst">Service GST (%)</Label>
                  <Input
                    id="sgst"
                    type="number"
                    step="0.01"
                    min={0}
                    max={28}
                    value={serviceGst}
                    onChange={(e) => setServiceGst(Number(e.target.value))}
                  />
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="ghsn">{billingType === 'SPLIT' ? 'Goods HSN' : 'HSN'}</Label>
                <Input id="ghsn" value={goodsHsn} onChange={(e) => setGoodsHsn(e.target.value)} />
              </div>

              {billingType === 'SPLIT' && (
                <div className="space-y-2">
                  <Label htmlFor="ssac">Service SAC</Label>
                  <Input
                    id="ssac"
                    value={serviceSac}
                    onChange={(e) => setServiceSac(e.target.value)}
                  />
                </div>
              )}

              <div className="space-y-2 sm:col-span-2">
                <Label htmlFor="gdesc">
                  {billingType === 'SPLIT' ? 'Goods description' : 'Description'}
                </Label>
                <Textarea
                  id="gdesc"
                  rows={2}
                  placeholder="Supply of Solar Power Generating System equipment"
                  value={goodsDesc}
                  onChange={(e) => setGoodsDesc(e.target.value)}
                />
              </div>

              {billingType === 'SPLIT' && (
                <div className="space-y-2 sm:col-span-2">
                  <Label htmlFor="sdesc">Service description</Label>
                  <Textarea
                    id="sdesc"
                    rows={2}
                    placeholder="Installation, erection & commissioning services"
                    value={serviceDesc}
                    onChange={(e) => setServiceDesc(e.target.value)}
                  />
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">
            {isContract ? 'Additional products (optional)' : 'Items'}
          </CardTitle>
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setPickerOpen(true)}>
              <Plus className="size-4" /> Add product
            </Button>
            <Button type="button" variant="ghost" size="sm" onClick={() => setItems((p) => [...p, newLine()])}>
              Add blank line
            </Button>
          </div>
        </CardHeader>
        <CardContent className="space-y-3">
          <div className="hidden gap-2 px-1 text-xs font-medium text-muted-foreground sm:grid sm:grid-cols-[2fr_70px_80px_80px_70px_90px_32px]">
            <span>Product</span>
            <span>HSN</span>
            <span>Qty</span>
            <span>Rate</span>
            <span>Disc</span>
            <span>GST%</span>
            <span />
          </div>
          {items.map((line) => (
            <div
              key={line.key}
              className="grid gap-2 rounded-lg border p-3 sm:grid-cols-[2fr_70px_80px_80px_70px_90px_32px] sm:items-start sm:rounded-none sm:border-0 sm:p-0"
            >
              <LineCell label="Product">
                <Input
                  value={line.productName}
                  onChange={(e) => updateLine(line.key, { productName: e.target.value })}
                  placeholder="Item / description"
                />
              </LineCell>
              <LineCell label="HSN">
                <Input
                  value={line.hsnCode}
                  onChange={(e) => updateLine(line.key, { hsnCode: e.target.value })}
                  placeholder="HSN"
                />
              </LineCell>
              <LineCell label="Qty">
                <Input
                  type="number"
                  step="0.001"
                  inputMode="decimal"
                  placeholder="Qty"
                  value={line.quantity}
                  onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })}
                />
              </LineCell>
              <LineCell label="Rate">
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Rate"
                  value={line.unitPrice}
                  onChange={(e) => updateLine(line.key, { unitPrice: Number(e.target.value) })}
                />
              </LineCell>
              <LineCell label="Discount">
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="Disc"
                  value={line.discount}
                  onChange={(e) => updateLine(line.key, { discount: Number(e.target.value) })}
                />
              </LineCell>
              <LineCell label="GST %">
                <Input
                  type="number"
                  step="0.01"
                  inputMode="decimal"
                  placeholder="GST %"
                  value={line.gstPercentage}
                  onChange={(e) => updateLine(line.key, { gstPercentage: Number(e.target.value) })}
                />
              </LineCell>
              <div className="flex justify-end sm:block">
                <Button
                  type="button"
                  variant="ghost"
                  size="icon"
                  className="size-9 text-destructive"
                  onClick={() => removeLine(line.key)}
                >
                  <Trash2 className="size-4" />
                  <span className="ml-1 text-sm sm:hidden">Remove</span>
                </Button>
              </div>
            </div>
          ))}
          {isContract && (
            <p className="text-xs text-muted-foreground">
              These are billed in addition to the contract value and appear as extra rows on the
              invoice. Leave blank if the contract value covers everything.
            </p>
          )}
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-base">Notes & terms</CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="notes">Notes</Label>
              <Textarea id="notes" rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="terms">Terms & conditions</Label>
              <Textarea id="terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="odisc">Overall discount (₹)</Label>
              <Input id="odisc" type="number" step="0.01" min={0} className="w-40" value={overallDiscount} onChange={(e) => setOverallDiscount(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-base">Summary</CardTitle>
          </CardHeader>
          <CardContent className="space-y-1 text-sm">
            {!isContract && 'subtotal' in totals && (
              <>
                <SummaryRow label="Subtotal" value={totals.subtotal} />
                {totals.totalDiscount > 0 && (
                  <SummaryRow label="Discount" value={-totals.totalDiscount} />
                )}
              </>
            )}
            {isContract && (
              <SummaryRow
                label={isTaxInclusive ? 'Contract value (incl. GST)' : 'Contract value'}
                value={contractValue || 0}
              />
            )}
            <SummaryRow label="Taxable" value={totals.taxableAmount} />
            {totals.isInterState ? (
              <SummaryRow label="IGST" value={totals.igstAmount} />
            ) : (
              <>
                <SummaryRow label="CGST" value={totals.cgstAmount} />
                <SummaryRow label="SGST" value={totals.sgstAmount} />
              </>
            )}
            {totals.roundOff !== 0 && <SummaryRow label="Round off" value={totals.roundOff} />}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand total</span>
              <span className="tabular-nums">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex flex-wrap items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>
          Cancel
        </Button>
        <Button type="button" variant="secondary" onClick={() => submit(false)} disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Save draft
        </Button>
        {canPost && (
          <Button type="button" onClick={() => submit(true)} disabled={isPending}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Save & post
          </Button>
        )}
      </div>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addProduct} />
    </div>
  );
}

function SummaryRow({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
