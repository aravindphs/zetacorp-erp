'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2 } from 'lucide-react';
import { toast } from 'sonner';
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
import { STOCK_TXN_LABELS, ADJUSTMENT_TYPES } from '@/constants/inventory';
import { adjustStockAction } from '@/features/inventory/product.actions';

export function AdjustStockDialog({
  open,
  onOpenChange,
  product,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  product: { id: string; productCode: string; productName: string; currentStock: number };
}) {
  const router = useRouter();
  const [type, setType] = useState<string>('ADJUSTMENT');
  const [quantity, setQuantity] = useState('');
  const [reason, setReason] = useState('');
  const [remarks, setRemarks] = useState('');
  const [isPending, startTransition] = useTransition();

  function submit() {
    startTransition(async () => {
      const result = await adjustStockAction({
        productId: product.id,
        transactionType: type,
        quantity: Number(quantity),
        reason,
        remarks,
      });
      if (result.success) {
        toast.success(`${result.message} New stock: ${result.data.stockAfter}`);
        onOpenChange(false);
        setQuantity('');
        setReason('');
        setRemarks('');
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
          <DialogTitle>Adjust stock</DialogTitle>
          <DialogDescription>
            {product.productName} ({product.productCode}) — current stock {product.currentStock}. Use
            a negative quantity to reduce stock.
          </DialogDescription>
        </DialogHeader>
        <div className="grid gap-4 sm:grid-cols-2">
          <div className="space-y-2">
            <Label>Type</Label>
            <Select value={type} onValueChange={(v) => setType(v ?? 'ADJUSTMENT')}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {ADJUSTMENT_TYPES.map((t) => (
                  <SelectItem key={t} value={t}>
                    {STOCK_TXN_LABELS[t]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="adj-qty">Quantity (± )</Label>
            <Input
              id="adj-qty"
              type="number"
              step="0.001"
              value={quantity}
              onChange={(e) => setQuantity(e.target.value)}
              placeholder="e.g. 10 or -5"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="adj-reason">Reason</Label>
            <Input
              id="adj-reason"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="Why is stock being adjusted?"
            />
          </div>
          <div className="space-y-2 sm:col-span-2">
            <Label htmlFor="adj-remarks">Remarks (optional)</Label>
            <Textarea
              id="adj-remarks"
              rows={2}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
        </div>
        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            onClick={submit}
            disabled={isPending || !quantity || Number(quantity) === 0 || reason.trim().length === 0}
          >
            {isPending && <Loader2 className="size-4 animate-spin" />}
            Apply
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
