'use client';

import { useRef, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Download, FileText, Loader2, Trash2, Upload } from 'lucide-react';
import { toast } from 'sonner';
import { ExpenseReceiptType } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { EmptyState } from '@/components/shared/page-states';
import { formatDateTime, formatFileSize } from '@/utils/format';
import {
  deleteReceiptAction,
  getReceiptUrlAction,
  uploadReceiptAction,
} from '@/features/expense/expense.actions';
import { RECEIPT_TYPE_LABELS, type ExpenseReceiptRow } from '@/features/expense/expense.types';

export function ExpenseReceipts({
  expenseId,
  receipts,
  canManage,
}: {
  expenseId: string;
  receipts: ExpenseReceiptRow[];
  /** Receipts are only attachable while the claim is undecided (§305). */
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [receiptType, setReceiptType] = useState<ExpenseReceiptType>('RECEIPT');
  const fileRef = useRef<HTMLInputElement>(null);

  function upload() {
    const file = fileRef.current?.files?.[0];
    if (!file) {
      toast.error('Select a file to upload.');
      return;
    }
    const formData = new FormData();
    formData.set('expenseId', expenseId);
    formData.set('receiptType', receiptType);
    formData.set('file', file);

    startTransition(async () => {
      const result = await uploadReceiptAction(formData);
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        if (fileRef.current) fileRef.current.value = '';
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function download(receiptId: string) {
    startTransition(async () => {
      const result = await getReceiptUrlAction(receiptId);
      if (result.success) window.open(result.data.url, '_blank');
      else toast.error(result.message);
    });
  }

  function remove(receiptId: string) {
    startTransition(async () => {
      const result = await deleteReceiptAction(receiptId, expenseId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-semibold">Receipts</h2>
        {canManage && (
          <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
            <Upload className="size-4" /> Attach
          </Button>
        )}
      </div>

      {receipts.length === 0 ? (
        <EmptyState
          title="No receipts attached."
          description="Invoices, bills, receipts and travel tickets can be attached here."
          action={
            canManage ? (
              <Button size="sm" onClick={() => setOpen(true)}>
                <Upload className="size-4" /> Attach receipt
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">File</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Uploaded</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {receipts.map((r) => (
                <tr key={r.id}>
                  <td className="px-3 py-2">
                    <div className="flex items-center gap-2">
                      <FileText className="size-4 shrink-0 text-muted-foreground" />
                      <span className="truncate font-medium">{r.fileName}</span>
                    </div>
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{RECEIPT_TYPE_LABELS[r.receiptType]}</Badge>
                  </td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {formatFileSize(r.fileSize)}
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8"
                        disabled={isPending}
                        onClick={() => download(r.id)}
                        title="Download"
                      >
                        <Download className="size-4" />
                      </Button>
                      {canManage && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          disabled={isPending}
                          onClick={() => remove(r.id)}
                          title="Remove"
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Attach receipt</DialogTitle>
            <DialogDescription>PDF, PNG, JPG or JPEG — up to 10 MB.</DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label>Receipt type</Label>
              <Select
                items={RECEIPT_TYPE_LABELS}
                value={receiptType}
                onValueChange={(v) => setReceiptType((v as ExpenseReceiptType) ?? 'RECEIPT')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(RECEIPT_TYPE_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="receipt-file">File</Label>
              <Input
                id="receipt-file"
                type="file"
                ref={fileRef}
                accept="application/pdf,image/png,image/jpeg"
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={upload} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Upload
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
