'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Receipt, Search } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod } from '@prisma/client';
import { Card, CardContent } from '@/components/ui/card';
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
import { formatCurrency, formatDate } from '@/utils/format';
import { recordPaymentAction } from '@/features/invoice/invoice.actions';
import { InvoicePicker } from '@/features/payment/components/invoice-picker';
import { NON_CASH_METHODS, PAYMENT_METHOD_LABELS } from '@/features/payment/payment.types';
import type { OutstandingInvoice } from '@/features/payment/payment.types';

export function RecordPaymentForm({ initialInvoice }: { initialInvoice?: OutstandingInvoice | null }) {
  const router = useRouter();
  const [pickerOpen, setPickerOpen] = useState(false);
  const [invoice, setInvoice] = useState<OutstandingInvoice | null>(initialInvoice ?? null);
  const [amount, setAmount] = useState(initialInvoice ? String(initialInvoice.balanceDue) : '');
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isPending, startTransition] = useTransition();

  const amountNum = Number(amount);
  const balanceDue = invoice?.balanceDue ?? 0;
  const referenceRequired = NON_CASH_METHODS.includes(method);
  const outstandingAfter = invoice ? Math.max(0, Number((balanceDue - (amountNum || 0)).toFixed(2))) : 0;

  const amountError =
    invoice && amount !== ''
      ? amountNum <= 0
        ? 'Amount must be greater than 0.'
        : amountNum > balanceDue + 0.01
          ? `Amount cannot exceed the outstanding balance of ${formatCurrency(balanceDue)}.`
          : null
      : null;

  const canSubmit =
    !!invoice &&
    !!amount &&
    !amountError &&
    !!paymentDate &&
    (!referenceRequired || reference.trim().length > 0);

  function pickInvoice(inv: OutstandingInvoice) {
    setInvoice(inv);
    setAmount(String(inv.balanceDue));
  }

  function submit() {
    if (!invoice) return;
    startTransition(async () => {
      const result = await recordPaymentAction(invoice.id, {
        amount: amountNum,
        paymentDate,
        paymentMethod: method,
        referenceNumber: reference || undefined,
        remarks: remarks || undefined,
      });
      if (result.success) {
        toast.success(result.message);
        router.push(`/payments/${result.data.id}`);
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-6">
      {/* Invoice selection (spec §225) */}
      <div className="space-y-2">
        <Label>Invoice</Label>
        {invoice ? (
          <Card>
            <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
              <div className="space-y-1">
                <p className="font-medium">{invoice.invoiceNumber}</p>
                <p className="text-sm text-muted-foreground">
                  {invoice.customerName}
                  {invoice.customerPhone ? ` · ${invoice.customerPhone}` : ''} ·{' '}
                  {formatDate(invoice.invoiceDate)}
                  {invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ''}
                </p>
              </div>
              <div className="flex items-center gap-6">
                <div className="text-right">
                  <p className="text-xs text-muted-foreground">Outstanding</p>
                  <p className="font-semibold tabular-nums">{formatCurrency(balanceDue)}</p>
                </div>
                <Button variant="outline" size="sm" onClick={() => setPickerOpen(true)} disabled={isPending}>
                  <Search className="size-4" /> Change
                </Button>
              </div>
            </CardContent>
          </Card>
        ) : (
          <Button variant="outline" onClick={() => setPickerOpen(true)} className="w-full justify-start">
            <Search className="size-4" /> Select an outstanding invoice…
          </Button>
        )}
      </div>

      {invoice && (
        <>
          {/* Payment details (spec §226) */}
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="pay-amount">Amount received (₹)</Label>
              <Input
                id="pay-amount"
                type="number"
                step="0.01"
                min={0}
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                aria-invalid={!!amountError}
              />
              {amountError && <p className="text-xs text-destructive">{amountError}</p>}
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-date">Payment date</Label>
              <Input
                id="pay-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select value={method} onValueChange={(v) => setMethod((v as PaymentMethod) ?? 'CASH')}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="pay-ref">
                Reference #{referenceRequired && <span className="text-destructive"> *</span>}
              </Label>
              <Input
                id="pay-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                placeholder={referenceRequired ? 'Required for non-cash methods' : 'Optional'}
                aria-invalid={referenceRequired && reference.trim().length === 0}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="pay-remarks">Remarks</Label>
              <Textarea id="pay-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
            </div>
          </div>

          {/* Summary (spec §224) */}
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 p-4 sm:grid-cols-4">
              <Summary label="Invoice total" value={formatCurrency(invoice.grandTotal)} />
              <Summary label="Already paid" value={formatCurrency(invoice.amountPaid)} />
              <Summary label="This payment" value={formatCurrency(amountNum || 0)} accent />
              <Summary label="Outstanding after" value={formatCurrency(outstandingAfter)} />
            </CardContent>
          </Card>

          <div className="flex items-center justify-end gap-2">
            <Button variant="outline" onClick={() => router.push('/payments')} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={submit} disabled={!canSubmit || isPending}>
              {isPending ? <Loader2 className="size-4 animate-spin" /> : <Receipt className="size-4" />}
              Record payment
            </Button>
          </div>
        </>
      )}

      <InvoicePicker open={pickerOpen} onOpenChange={setPickerOpen} onSelect={pickInvoice} />
    </div>
  );
}

function Summary({ label, value, accent }: { label: string; value: string; accent?: boolean }) {
  return (
    <div>
      <p className="text-xs text-muted-foreground">{label}</p>
      <p className={`mt-1 truncate text-lg font-semibold tabular-nums ${accent ? 'text-green-600' : ''}`}>
        {value}
      </p>
    </div>
  );
}
