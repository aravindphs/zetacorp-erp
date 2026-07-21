'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Banknote, Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import { PaymentMethod, type ExpenseStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/shared/button-link';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
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
import { formatCurrency } from '@/utils/format';
import {
  approveExpenseAction,
  cancelExpenseAction,
  reimburseExpenseAction,
  rejectExpenseAction,
} from '@/features/expense/expense.actions';
import {
  CANCELLABLE_STATUSES,
  EDITABLE_STATUSES,
  REIMBURSEMENT_METHOD_LABELS,
} from '@/features/expense/expense.types';

type DialogKind = 'approve' | 'reject' | 'cancel' | 'reimburse' | null;

export function ExpenseDetailActions({
  expenseId,
  status,
  amount,
  isOwner,
  canApprove,
  canReject,
  canReimburse,
  canDecide,
}: {
  expenseId: string;
  status: ExpenseStatus;
  amount: number;
  isOwner: boolean;
  canApprove: boolean;
  canReject: boolean;
  canReimburse: boolean;
  /** Engine-resolved: does this user approve *this* claim? (§307) */
  canDecide: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [remarks, setRemarks] = useState('');

  // Reimbursement fields (§308)
  const [paymentDate, setPaymentDate] = useState(new Date().toISOString().slice(0, 10));
  const [method, setMethod] = useState<PaymentMethod>('BANK_TRANSFER');
  const [reference, setReference] = useState('');

  const showApprove = status === 'PENDING' && canApprove && canDecide;
  const showReject = status === 'PENDING' && canReject && canDecide;
  const showCancel = CANCELLABLE_STATUSES.includes(status) && isOwner;
  const showEdit = EDITABLE_STATUSES.includes(status) && isOwner;
  const showReimburse = status === 'APPROVED' && canReimburse;

  function run(fn: () => Promise<{ success: boolean; message: string }>) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(result.message);
        setDialog(null);
        setRemarks('');
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showEdit && (
        <ButtonLink href={`/finance/expenses/${expenseId}/edit`} size="sm" variant="outline">
          <Pencil className="size-4" /> Edit
        </ButtonLink>
      )}
      {showApprove && (
        <Button size="sm" onClick={() => setDialog('approve')}>
          <Check className="size-4" /> Approve
        </Button>
      )}
      {showReject && (
        <Button
          size="sm"
          variant="outline"
          className="text-destructive"
          onClick={() => setDialog('reject')}
        >
          <X className="size-4" /> Reject
        </Button>
      )}
      {showReimburse && (
        <Button size="sm" onClick={() => setDialog('reimburse')}>
          <Banknote className="size-4" /> Record reimbursement
        </Button>
      )}
      {showCancel && (
        <Button size="sm" variant="outline" onClick={() => setDialog('cancel')}>
          <Ban className="size-4" /> Cancel claim
        </Button>
      )}

      {/* Approve / reject / cancel share a remarks-only dialog. */}
      <Dialog
        open={dialog !== null && dialog !== 'reimburse'}
        onOpenChange={(o) => !o && setDialog(null)}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>
              {dialog === 'approve'
                ? 'Approve expense'
                : dialog === 'reject'
                  ? 'Reject expense'
                  : 'Cancel this claim'}
            </DialogTitle>
            <DialogDescription>
              {dialog === 'approve'
                ? 'This approves the claim and makes it available for reimbursement.'
                : dialog === 'reject'
                  ? 'Rejected claims cannot be resubmitted — a new claim is required.'
                  : 'This withdraws your claim. This cannot be undone.'}
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="exp-remarks">
              {dialog === 'cancel' ? 'Reason' : 'Remarks'}{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="exp-remarks"
              rows={3}
              value={remarks}
              onChange={(e) => setRemarks(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              Back
            </Button>
            <Button
              variant={dialog === 'approve' ? 'default' : 'destructive'}
              disabled={isPending}
              onClick={() => {
                if (dialog === 'approve') {
                  run(() => approveExpenseAction(expenseId, { remarks: remarks || undefined }));
                } else if (dialog === 'reject') {
                  run(() => rejectExpenseAction(expenseId, { remarks: remarks || undefined }));
                } else {
                  run(() => cancelExpenseAction(expenseId, { reason: remarks || undefined }));
                }
              }}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {dialog === 'approve' ? 'Approve' : dialog === 'reject' ? 'Reject' : 'Cancel claim'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Reimbursement (§308) */}
      <Dialog open={dialog === 'reimburse'} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Record reimbursement</DialogTitle>
            <DialogDescription>
              Reimbursing {formatCurrency(amount)} marks the claim REIMBURSED and posts a financial
              transaction.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-2">
              <Label htmlFor="reimb-date">Payment date</Label>
              <Input
                id="reimb-date"
                type="date"
                value={paymentDate}
                onChange={(e) => setPaymentDate(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Payment method</Label>
              <Select
                items={REIMBURSEMENT_METHOD_LABELS}
                value={method}
                onValueChange={(v) => setMethod((v as PaymentMethod) ?? 'BANK_TRANSFER')}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(REIMBURSEMENT_METHOD_LABELS).map(([v, l]) => (
                    <SelectItem key={v} value={v}>
                      {l}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="space-y-2">
              <Label htmlFor="reimb-ref">Reference #</Label>
              <Input
                id="reimb-ref"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
              />
            </div>
            <div className="space-y-2 sm:col-span-2">
              <Label htmlFor="reimb-remarks">Remarks</Label>
              <Textarea
                id="reimb-remarks"
                rows={2}
                value={remarks}
                onChange={(e) => setRemarks(e.target.value)}
              />
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDialog(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || !paymentDate}
              onClick={() =>
                run(() =>
                  reimburseExpenseAction(expenseId, {
                    paymentDate,
                    paymentMethod: method,
                    referenceNumber: reference || undefined,
                    remarks: remarks || undefined,
                  }),
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Record reimbursement
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
