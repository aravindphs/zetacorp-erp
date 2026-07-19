'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod } from '@prisma/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
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
import { recordPaymentAction } from '@/features/invoice/invoice.actions';

const METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  OTHER: 'Other',
};

export function RecordPaymentDialog({
  open,
  onOpenChange,
  invoiceId,
  balanceDue,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  invoiceId: string;
  balanceDue: number;
}) {
  const router = useRouter();
  const [amount, setAmount] = useState(String(balanceDue));
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('CASH');
  const [reference, setReference] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await recordPaymentAction(invoiceId, {
        amount: Number(amount),
        paymentDate,
        paymentMethod: method,
        referenceNumber: reference || undefined,
        remarks: remarks || undefined,
      });
      if (result.success) {
        toast.success(result.message);
        onOpenChange(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Record payment</DialogTitle>
          <DialogDescription>Outstanding balance: {formatCurrency(balanceDue)}</DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="pay-amount">Amount (₹)</Label>
            <Input id="pay-amount" type="number" step="0.01" min={0} value={amount} onChange={(e) => setAmount(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-date">Date</Label>
            <Input id="pay-date" type="date" value={paymentDate} onChange={(e) => setPaymentDate(e.target.value)} />
          </div>
          <div className="space-y-2">
            <Label>Method</Label>
            <Select value={method} onValueChange={(v) => setMethod((v as PaymentMethod) ?? 'CASH')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {Object.entries(METHOD_LABELS).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="pay-ref">Reference #</Label>
            <Input id="pay-ref" value={reference} onChange={(e) => setReference(e.target.value)} />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="pay-remarks">Remarks</Label>
            <Textarea id="pay-remarks" rows={2} value={remarks} onChange={(e) => setRemarks(e.target.value)} />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button onClick={submit} disabled={isPending || !amount || Number(amount) <= 0}>
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Record
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
