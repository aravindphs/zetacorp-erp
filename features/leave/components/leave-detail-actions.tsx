'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Ban, Check, Loader2, Pencil, X } from 'lucide-react';
import { toast } from 'sonner';
import type { LeaveStatus } from '@prisma/client';
import { Button } from '@/components/ui/button';
import { ButtonLink } from '@/components/shared/button-link';
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
  approveLeaveAction,
  cancelLeaveAction,
  rejectLeaveAction,
} from '@/features/leave/leave.actions';
import { CANCELLABLE_STATUSES, EDITABLE_STATUSES } from '@/features/leave/leave.types';

type DialogKind = 'approve' | 'reject' | 'cancel' | null;

export function LeaveDetailActions({
  leaveId,
  status,
  isOwner,
  canApprove,
  canReject,
  canDecide,
}: {
  leaveId: string;
  status: LeaveStatus;
  isOwner: boolean;
  canApprove: boolean;
  canReject: boolean;
  /** Engine-resolved: does this user actually approve *this* request? (§284) */
  canDecide: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [dialog, setDialog] = useState<DialogKind>(null);
  const [remarks, setRemarks] = useState('');

  const isPendingStatus = status === 'PENDING';
  const showApprove = isPendingStatus && canApprove && canDecide;
  const showReject = isPendingStatus && canReject && canDecide;
  const showCancel = CANCELLABLE_STATUSES.includes(status) && isOwner;
  const showEdit = EDITABLE_STATUSES.includes(status) && isOwner;

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

  const config = {
    approve: {
      title: 'Approve leave',
      description: 'This approves the request and notifies the employee.',
      confirm: 'Approve',
      onConfirm: () => run(() => approveLeaveAction(leaveId, { remarks: remarks || undefined })),
      destructive: false,
    },
    reject: {
      title: 'Reject leave',
      description: 'Rejected requests cannot be resubmitted — a new request is required.',
      confirm: 'Reject',
      onConfirm: () => run(() => rejectLeaveAction(leaveId, { remarks: remarks || undefined })),
      destructive: true,
    },
    cancel: {
      title: 'Cancel this request',
      description: 'This withdraws your leave request. This cannot be undone.',
      confirm: 'Cancel request',
      onConfirm: () => run(() => cancelLeaveAction(leaveId, { reason: remarks || undefined })),
      destructive: true,
    },
  } as const;

  const active = dialog ? config[dialog] : null;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {showEdit && (
        <ButtonLink href={`/workforce/leave/${leaveId}/edit`} size="sm" variant="outline">
          <Pencil className="size-4" /> Edit
        </ButtonLink>
      )}
      {showApprove && (
        <Button size="sm" onClick={() => setDialog('approve')}>
          <Check className="size-4" /> Approve
        </Button>
      )}
      {showReject && (
        <Button size="sm" variant="outline" className="text-destructive" onClick={() => setDialog('reject')}>
          <X className="size-4" /> Reject
        </Button>
      )}
      {showCancel && (
        <Button size="sm" variant="outline" onClick={() => setDialog('cancel')}>
          <Ban className="size-4" /> Cancel request
        </Button>
      )}

      <Dialog open={dialog !== null} onOpenChange={(o) => !o && setDialog(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{active?.title}</DialogTitle>
            <DialogDescription>{active?.description}</DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="leave-remarks">
              {dialog === 'cancel' ? 'Reason' : 'Remarks'}{' '}
              <span className="text-muted-foreground">(optional)</span>
            </Label>
            <Textarea
              id="leave-remarks"
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
              variant={active?.destructive ? 'destructive' : 'default'}
              onClick={() => active?.onConfirm()}
              disabled={isPending}
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              {active?.confirm}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
