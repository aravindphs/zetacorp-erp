'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Copy, FileDown, Loader2, Send, ThumbsDown, ThumbsUp, ArrowRightLeft } from 'lucide-react';
import { toast } from 'sonner';
import type { QuotationStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  cancelQuotationAction,
  changeQuotationStatusAction,
  convertQuotationAction,
  duplicateQuotationAction,
} from '@/features/quotation/quotation.actions';

interface Perms {
  update: boolean;
  cancel: boolean;
  duplicate: boolean;
  convert: boolean;
  print: boolean;
}

export function QuotationDetailActions({
  quotationId,
  status,
  perms,
}: {
  quotationId: string;
  status: QuotationStatus;
  perms: Perms;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [reason, setReason] = useState('');

  const run = (fn: () => Promise<{ success: boolean; message: string } & Record<string, unknown>>, after?: () => void) =>
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(result.message);
        after?.();
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });

  const isOpen = status === 'DRAFT' || status === 'SENT';

  return (
    <div className="flex flex-wrap items-center gap-2">
      {perms.update && status === 'DRAFT' && (
        <Button size="sm" onClick={() => run(() => changeQuotationStatusAction(quotationId, { status: 'SENT' }))} disabled={isPending}>
          <Send className="size-4" /> Send
        </Button>
      )}
      {perms.update && status === 'SENT' && (
        <>
          <Button size="sm" onClick={() => run(() => changeQuotationStatusAction(quotationId, { status: 'ACCEPTED' }))} disabled={isPending}>
            <ThumbsUp className="size-4" /> Accept
          </Button>
          <Button size="sm" variant="outline" onClick={() => run(() => changeQuotationStatusAction(quotationId, { status: 'REJECTED' }))} disabled={isPending}>
            <ThumbsDown className="size-4" /> Reject
          </Button>
        </>
      )}
      {perms.convert && status !== 'CANCELLED' && status !== 'EXPIRED' && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => convertQuotationAction(quotationId), )}
          disabled={isPending}
        >
          <ArrowRightLeft className="size-4" /> Convert to invoice
        </Button>
      )}
      {perms.print && (
        <Button size="sm" variant="outline" onClick={() => window.open(`/api/quotations/${quotationId}/pdf`, '_blank')}>
          <FileDown className="size-4" /> PDF
        </Button>
      )}
      {perms.duplicate && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => run(() => duplicateQuotationAction(quotationId))}
          disabled={isPending}
        >
          <Copy className="size-4" /> Duplicate
        </Button>
      )}
      {perms.cancel && isOpen && (
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" /> Cancel
        </Button>
      )}

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel quotation</DialogTitle>
            <DialogDescription>Provide a reason. This cannot be undone.</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="q-cancel-reason">Reason</Label>
            <Textarea id="q-cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>Keep</Button>
            <Button
              variant="destructive"
              disabled={isPending || reason.trim().length === 0}
              onClick={() => run(() => cancelQuotationAction(quotationId, { reason }), () => setCancelOpen(false))}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Cancel quotation
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
