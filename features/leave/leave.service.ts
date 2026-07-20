import 'server-only';

/**
 * Leave business logic (spec §274, §286, §287).
 *
 * Approval is delegated entirely to the Approval Workflow Engine (§284) — this
 * module never decides who may approve. It only maps engine outcomes back onto
 * the leave request's own status.
 */
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { auditCreate, auditUpdate } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { getSetting } from '@/features/settings/settings.cache';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors';
import {
  cancelApproval,
  recordApprovalDecision,
  startApproval,
  type ApprovalDecision,
} from '@/services/approval.service';
import { calculateLeaveDays } from '@/features/leave/leave.calc';
import { CANCELLABLE_STATUSES, EDITABLE_STATUSES } from '@/features/leave/leave.types';
import type { ApplyLeaveInput } from '@/features/leave/leave.schema';
import type { AuthUser } from '@/types/auth';

const LEAVE_MODULE = 'leave';

function leaveNumberKey(date: Date) {
  const year = date.getFullYear();
  return { key: `leave:${year}`, prefix: `LV-${year}` };
}

async function computeDays(input: ApplyLeaveInput): Promise<number> {
  const excludeWeekends = await getSetting<boolean>('leave.exclude_weekends', true);
  return calculateLeaveDays(new Date(input.fromDate), new Date(input.toDate), {
    excludeWeekends: Boolean(excludeWeekends),
    isHalfDay: input.isHalfDay,
  });
}

/** No overlapping pending/approved leave for the same employee (§286). */
async function assertNoOverlap(
  employeeId: string,
  fromDate: Date,
  toDate: Date,
  excludeId?: string,
): Promise<void> {
  const clash = await prisma.leaveRequest.findFirst({
    where: {
      employeeId,
      isDeleted: false,
      status: { in: ['PENDING', 'APPROVED'] },
      // Inclusive range intersection.
      fromDate: { lte: toDate },
      toDate: { gte: fromDate },
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { leaveNumber: true, fromDate: true, toDate: true },
  });
  if (clash) {
    throw new BusinessRuleError(
      `This overlaps leave ${clash.leaveNumber} already requested for those dates.`,
    );
  }
}

export async function applyForLeave(user: AuthUser, input: ApplyLeaveInput) {
  const leaveType = await prisma.leaveType.findFirst({
    where: { id: input.leaveTypeId, isDeleted: false, isActive: true },
    select: { id: true, name: true },
  });
  if (!leaveType) throw new NotFoundError('Leave type not found.');

  const fromDate = new Date(input.fromDate);
  const toDate = new Date(input.toDate);
  if (input.submit) await assertNoOverlap(user.id, fromDate, toDate);

  const totalDays = await computeDays(input);
  if (totalDays <= 0) {
    throw new BusinessRuleError(
      'The selected range contains no working days. Adjust the dates or disable weekend exclusion.',
    );
  }

  const leave = await prisma.$transaction(async (tx) => {
    const { key, prefix } = leaveNumberKey(fromDate);
    const leaveNumber = await generateCode(tx, { key, prefix });

    const created = await tx.leaveRequest.create({
      data: {
        leaveNumber,
        employeeId: user.id,
        leaveTypeId: input.leaveTypeId,
        fromDate,
        toDate,
        totalDays,
        isHalfDay: input.isHalfDay,
        reason: input.reason,
        emergencyContact: input.emergencyContact,
        delegateEmployeeId: input.delegateEmployeeId,
        status: input.submit ? 'PENDING' : 'DRAFT',
        ...auditCreate(user.id),
      },
    });

    // Only submitted requests enter the approval engine (§274).
    if (input.submit) {
      const outcome = await startApproval(tx, {
        module: LEAVE_MODULE,
        referenceId: created.id,
        requesterId: user.id,
      });
      await tx.leaveRequest.update({
        where: { id: created.id },
        data: { approvalRequestId: outcome.approvalRequestId },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: 'CREATE',
        module: LEAVE_MODULE,
        referenceId: created.id,
        newValue: { leaveNumber, status: created.status, totalDays },
      },
      tx,
    );
    return created;
  });

  await logActivity({
    userId: user.id,
    activity: input.submit
      ? `Applied for ${leaveType.name} (${leave.leaveNumber})`
      : `Saved draft leave ${leave.leaveNumber}`,
    module: LEAVE_MODULE,
    referenceId: leave.id,
  });
  return leave;
}

/** Edit a draft, optionally submitting it (§287 — only drafts are editable). */
export async function updateLeave(user: AuthUser, id: string, input: ApplyLeaveInput) {
  const existing = await prisma.leaveRequest.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeId: true, status: true, leaveNumber: true },
  });
  if (!existing) throw new NotFoundError('Leave request not found.');
  if (existing.employeeId !== user.id) {
    throw new ForbiddenError('You can only edit your own leave requests.');
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new BusinessRuleError('Only draft requests can be edited.');
  }

  const fromDate = new Date(input.fromDate);
  const toDate = new Date(input.toDate);
  if (input.submit) await assertNoOverlap(user.id, fromDate, toDate, id);
  const totalDays = await computeDays(input);

  const leave = await prisma.$transaction(async (tx) => {
    const updated = await tx.leaveRequest.update({
      where: { id },
      data: {
        leaveTypeId: input.leaveTypeId,
        fromDate,
        toDate,
        totalDays,
        isHalfDay: input.isHalfDay,
        reason: input.reason,
        emergencyContact: input.emergencyContact,
        delegateEmployeeId: input.delegateEmployeeId ?? null,
        status: input.submit ? 'PENDING' : 'DRAFT',
        ...auditUpdate(user.id),
      },
    });

    if (input.submit) {
      const outcome = await startApproval(tx, {
        module: LEAVE_MODULE,
        referenceId: id,
        requesterId: user.id,
      });
      await tx.leaveRequest.update({
        where: { id },
        data: { approvalRequestId: outcome.approvalRequestId },
      });
    }

    await logAudit(
      { userId: user.id, action: 'UPDATE', module: LEAVE_MODULE, referenceId: id, newValue: { status: updated.status } },
      tx,
    );
    return updated;
  });

  await logActivity({
    userId: user.id,
    activity: `Updated leave ${existing.leaveNumber}`,
    module: LEAVE_MODULE,
    referenceId: id,
  });
  return leave;
}

/**
 * Approve or reject. The engine owns the authorisation decision; a rejection or
 * a fully-approved workflow maps back onto the leave status.
 */
export async function decideLeave(
  user: AuthUser,
  id: string,
  decision: ApprovalDecision,
  remarks?: string,
) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      leaveNumber: true,
      employeeId: true,
      status: true,
      approvalRequestId: true,
    },
  });
  if (!leave) throw new NotFoundError('Leave request not found.');
  if (leave.status !== 'PENDING') {
    throw new BusinessRuleError('Only pending requests can be approved or rejected.');
  }
  if (!leave.approvalRequestId) {
    throw new BusinessRuleError('This request has no approval workflow attached.');
  }

  await prisma.$transaction(async (tx) => {
    const outcome = await recordApprovalDecision(
      tx,
      user,
      leave.approvalRequestId as string,
      decision,
      remarks,
    );

    // Mirror the engine's terminal outcome onto the leave record.
    if (outcome.status === 'APPROVED' || outcome.status === 'REJECTED') {
      await tx.leaveRequest.update({
        where: { id },
        data: {
          status: outcome.status,
          approvedBy: user.id,
          approvalDate: new Date(),
          remarks,
          ...auditUpdate(user.id),
        },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: decision === 'APPROVED' ? 'LEAVE_APPROVE' : 'LEAVE_REJECT',
        module: LEAVE_MODULE,
        referenceId: id,
        newValue: { leaveNumber: leave.leaveNumber, remarks, outcome: outcome.status },
      },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} leave ${leave.leaveNumber}`,
    module: LEAVE_MODULE,
    referenceId: id,
  });
}

/** Withdraw a draft or pending request (§287). */
export async function cancelLeave(user: AuthUser, id: string, reason?: string) {
  const leave = await prisma.leaveRequest.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      leaveNumber: true,
      employeeId: true,
      status: true,
      approvalRequestId: true,
    },
  });
  if (!leave) throw new NotFoundError('Leave request not found.');

  // Employees cancel their own; leave.cancel holders may cancel any.
  const isOwner = leave.employeeId === user.id;
  if (!isOwner && !user.permissions.has('leave.cancel')) {
    throw new ForbiddenError('You can only cancel your own leave requests.');
  }
  if (!CANCELLABLE_STATUSES.includes(leave.status)) {
    throw new BusinessRuleError('Only draft or pending requests can be cancelled.');
  }

  await prisma.$transaction(async (tx) => {
    if (leave.approvalRequestId) {
      await cancelApproval(tx, leave.approvalRequestId, user.id, reason);
    }
    await tx.leaveRequest.update({
      where: { id },
      data: { status: 'CANCELLED', remarks: reason, ...auditUpdate(user.id) },
    });
    await logAudit(
      { userId: user.id, action: 'LEAVE_CANCEL', module: LEAVE_MODULE, referenceId: id, oldValue: { status: leave.status, reason } },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Cancelled leave ${leave.leaveNumber}`,
    module: LEAVE_MODULE,
    referenceId: id,
  });
}
