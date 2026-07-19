'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, CheckCircle2, FileDown, Loader2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import type { InvoiceStatus } from '@prisma/client';
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
import { RecordPaymentDialog } from '@/features/invoice/components/record-payment-dialog';
import { cancelInvoiceAction, postInvoiceAction } from '@/features/invoice/invoice.actions';

export function InvoiceDetailActions({
  invoiceId,
  status,
  balanceDue,
  canPost,
  canCancel,
  canPrint,
  canRecordPayment,
}: {
  invoiceId: string;
  status: InvoiceStatus;
  balanceDue: number;
  canPost: boolean;
  canCancel: boolean;
  canPrint: boolean;
  canRecordPayment: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [cancelOpen, setCancelOpen] = useState(false);
  const [payOpen, setPayOpen] = useState(false);
  const [reason, setReason] = useState('');

  function post() {
    startTransition(async () => {
      const result = await postInvoiceAction(invoiceId);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function cancel() {
    startTransition(async () => {
      const result = await cancelInvoiceAction(invoiceId, { reason });
      if (result.success) {
        toast.success(result.message);
        setCancelOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {status === 'DRAFT' && canPost && (
        <Button size="sm" onClick={post} disabled={isPending}>
          {isPending ? <Loader2 className="size-4 animate-spin" /> : <CheckCircle2 className="size-4" />}
          Post invoice
        </Button>
      )}
      {status === 'POSTED' && canRecordPayment && balanceDue > 0 && (
        <Button size="sm" variant="outline" onClick={() => setPayOpen(true)}>
          <Wallet className="size-4" /> Record payment
        </Button>
      )}
      {canPrint && (
        <Button
          size="sm"
          variant="outline"
          onClick={() => window.open(`/api/invoices/${invoiceId}/pdf`, '_blank')}
        >
          <FileDown className="size-4" /> PDF
        </Button>
      )}
      {status === 'POSTED' && canCancel && (
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setCancelOpen(true)}>
          <Ban className="size-4" /> Cancel
        </Button>
      )}

      <RecordPaymentDialog open={payOpen} onOpenChange={setPayOpen} invoiceId={invoiceId} balanceDue={balanceDue} />

      <Dialog open={cancelOpen} onOpenChange={setCancelOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Cancel invoice</DialogTitle>
            <DialogDescription>
              This restores stock and marks the invoice cancelled. It cannot be edited afterwards.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="cancel-reason">Reason</Label>
            <Textarea id="cancel-reason" rows={3} value={reason} onChange={(e) => setReason(e.target.value)} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setCancelOpen(false)} disabled={isPending}>
              Keep invoice
            </Button>
            <Button variant="destructive" onClick={cancel} disabled={isPending || reason.trim().length === 0}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Cancel invoice
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
