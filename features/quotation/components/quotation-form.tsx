'use client';

/**
 * Create quotation form (spec §167–§173). Same dynamic line items + live totals
 * as invoices (shared engine); never affects stock. Reuses the ProductPicker.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Plus, Trash2, UserPlus } from 'lucide-react';
import { toast } from 'sonner';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Button } from '@/components/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { formatCurrency } from '@/utils/format';
import { calculateInvoice } from '@/features/invoice/invoice.calc';
import { ProductPicker, type PickerProduct } from '@/features/invoice/components/product-picker';
import { LineCell, LineHeader } from '@/components/shared/line-cell';
import { NewCustomerDialog } from '@/features/customer/components/new-customer-dialog';
import { DEFAULT_INVOICE_TERMS } from '@/constants/app';
import { createQuotationAction } from '@/features/quotation/quotation.actions';

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
  key: `q${counter++}`,
  productName: '',
  hsnCode: '',
  unit: 'Nos',
  quantity: 1,
  unitPrice: 0,
  discount: 0,
  gstPercentage: 0,
});

export function QuotationForm({
  customers,
  initialCustomerId,
  companyState,
}: {
  customers: { id: string; code: string; name: string }[];
  initialCustomerId?: string;
  companyState: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pickerOpen, setPickerOpen] = useState(false);

  const today = new Date().toISOString().slice(0, 10);
  const [customerId, setCustomerId] = useState(initialCustomerId ?? '');
  // Local copy so an inline-created customer can be appended and selected.
  const [customerList, setCustomerList] = useState(customers);
  const [newCustomerOpen, setNewCustomerOpen] = useState(false);
  const [quotationDate, setQuotationDate] = useState(today);
  const [validUntil, setValidUntil] = useState('');
  const [placeOfSupply, setPlaceOfSupply] = useState('');
  const [referenceNumber, setReferenceNumber] = useState('');
  const [overallDiscount, setOverallDiscount] = useState(0);
  const [remarks, setRemarks] = useState('');
  const [terms, setTerms] = useState(DEFAULT_INVOICE_TERMS);
  const [items, setItems] = useState<LineItem[]>([newLine()]);

  const totals = useMemo(
    () =>
      calculateInvoice({
        lines: items.map((i) => ({ quantity: i.quantity || 0, unitPrice: i.unitPrice || 0, discount: i.discount || 0, gstPercentage: i.gstPercentage || 0 })),
        overallDiscount,
        companyState,
        placeOfSupply,
      }),
    [items, overallDiscount, companyState, placeOfSupply],
  );

  const updateLine = (key: string, patch: Partial<LineItem>) =>
    setItems((prev) => prev.map((l) => (l.key === key ? { ...l, ...patch } : l)));
  const removeLine = (key: string) =>
    setItems((prev) => (prev.length > 1 ? prev.filter((l) => l.key !== key) : prev));
  const addProduct = (p: PickerProduct) =>
    setItems((prev) => [
      ...prev.filter((l) => l.productName || l.unitPrice),
      { key: `q${counter++}`, productId: p.id, productName: p.productName, hsnCode: p.hsnCode ?? '', unit: p.unit, quantity: 1, unitPrice: p.sellingPrice, discount: 0, gstPercentage: p.gstPercentage },
    ]);

  /** Append an inline-created customer and select them. */
  function onCustomerCreated(c: { id: string; name: string; code: string }) {
    setCustomerList((prev) => [{ id: c.id, name: c.name, code: c.code }, ...prev]);
    setCustomerId(c.id);
  }

  function submit() {
    if (!customerId) return toast.error('Select a customer.');
    const validItems = items.filter((l) => l.productName.trim() && l.quantity > 0);
    if (validItems.length === 0) return toast.error('Add at least one item.');
    startTransition(async () => {
      const result = await createQuotationAction({
        customerId,
        quotationDate,
        validUntil: validUntil || undefined,
        placeOfSupply: placeOfSupply || undefined,
        referenceNumber: referenceNumber || undefined,
        overallDiscount,
        remarks: remarks || undefined,
        termsConditions: terms || undefined,
        items: validItems.map((l) => ({
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
        router.push(`/quotations/${result.data.id}`);
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
          <CardTitle className="text-base">Quotation details</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 sm:grid-cols-3">
          <div className="space-y-2">
            <Label>Customer *</Label>
            <div className="flex gap-2">
              <Select
                items={Object.fromEntries(customerList.map((c) => [c.id, `${c.name} (${c.code})`]))}
                value={customerId}
                onValueChange={(v) => setCustomerId(v ?? '')}
              >
                <SelectTrigger className="flex-1">
                  <SelectValue placeholder="Select customer" />
                </SelectTrigger>
                <SelectContent>
                  {customerList.map((c) => (
                    <SelectItem key={c.id} value={c.id}>{c.name} ({c.code})</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Button
                type="button"
                variant="outline"
                size="icon"
                title="New customer"
                onClick={() => setNewCustomerOpen(true)}
              >
                <UserPlus className="size-4" />
              </Button>
            </div>
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-date">Quotation date *</Label>
            <Input id="q-date" type="date" value={quotationDate} onChange={(e) => setQuotationDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="valid">Valid until</Label>
            <Input id="valid" type="date" value={validUntil} onChange={(e) => setValidUntil(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-pos">Place of supply</Label>
            <Input id="q-pos" value={placeOfSupply} onChange={(e) => setPlaceOfSupply(e.target.value)} placeholder="State" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="q-ref">Reference #</Label>
            <Input id="q-ref" value={referenceNumber} onChange={(e) => setReferenceNumber(e.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader className="flex flex-row items-center justify-between space-y-0">
          <CardTitle className="text-base">Items</CardTitle>
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
          <LineHeader
            columns={['Product', 'HSN', 'Qty', 'Rate', 'Disc', 'GST%']}
            className="sm:grid-cols-[2fr_70px_80px_80px_70px_90px_32px]"
          />
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
        </CardContent>
      </Card>

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader><CardTitle className="text-base">Notes & terms</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="q-remarks">Remarks</Label>
              <Textarea id="q-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-terms">Terms & conditions</Label>
              <Textarea id="q-terms" rows={2} value={terms} onChange={(e) => setTerms(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="q-odisc">Overall discount (₹)</Label>
              <Input id="q-odisc" type="number" step="0.01" min={0} className="w-40" value={overallDiscount} onChange={(e) => setOverallDiscount(Number(e.target.value))} />
            </div>
          </CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Summary</CardTitle></CardHeader>
          <CardContent className="space-y-1 text-sm">
            <Row label="Subtotal" value={totals.subtotal} />
            {totals.totalDiscount > 0 && <Row label="Discount" value={-totals.totalDiscount} />}
            <Row label="Taxable" value={totals.taxableAmount} />
            {totals.isInterState ? (
              <Row label="IGST" value={totals.igstAmount} />
            ) : (
              <>
                <Row label="CGST" value={totals.cgstAmount} />
                <Row label="SGST" value={totals.sgstAmount} />
              </>
            )}
            {totals.roundOff !== 0 && <Row label="Round off" value={totals.roundOff} />}
            <div className="flex justify-between border-t pt-2 text-base font-semibold">
              <span>Grand total</span>
              <span className="tabular-nums">{formatCurrency(totals.grandTotal)}</span>
            </div>
          </CardContent>
        </Card>
      </div>

      <div className="flex items-center justify-end gap-2">
        <Button type="button" variant="outline" onClick={() => router.back()} disabled={isPending}>Cancel</Button>
        <Button type="button" onClick={submit} disabled={isPending}>
          {isPending && <Loader2 className="size-4 animate-spin" />}
          Create quotation
        </Button>
      </div>

      <ProductPicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={addProduct} />
      <NewCustomerDialog
        open={newCustomerOpen}
        onOpenChange={setNewCustomerOpen}
        onCreated={onCustomerCreated}
      />
    </div>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <div className="flex justify-between">
      <span className="text-muted-foreground">{label}</span>
      <span className="tabular-nums">{formatCurrency(value)}</span>
    </div>
  );
}
