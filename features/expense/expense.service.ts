import 'server-only';

/**
 * Expense business logic (spec §299, §308, §310, §311).
 *
 * Approval is delegated entirely to the Approval Workflow Engine (§307) — this
 * module never decides who may approve; it only maps engine outcomes onto the
 * claim's own status. Reimbursement writes an append-only Financial
 * Transaction (§311).
 */
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { auditCreate, auditUpdate } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { recordFinancialTransaction } from '@/services/financial-transaction.service';
import { getSetting } from '@/features/settings/settings.cache';
import { BusinessRuleError, ForbiddenError, NotFoundError } from '@/lib/errors';
import { CODE_PREFIX } from '@/constants/app';
import {
  cancelApproval,
  recordApprovalDecision,
  startApproval,
  type ApprovalDecision,
} from '@/services/approval.service';
import { CANCELLABLE_STATUSES, EDITABLE_STATUSES } from '@/features/expense/expense.types';
import type {
  ReimburseExpenseInput,
  SubmitExpenseInput,
} from '@/features/expense/expense.schema';
import type { AuthUser } from '@/types/auth';

const EXPENSE_MODULE = 'expense';

function expenseNumberKey(date: Date) {
  const year = date.getFullYear();
  return { key: `expense:${year}`, prefix: `${CODE_PREFIX.EXPENSE}-${year}` };
}

/** §310: future-dated claims are rejected unless explicitly allowed. */
async function assertValidExpenseDate(expenseDate: Date): Promise<void> {
  const allowFuture = await getSetting<boolean>('expense.allow_future_dates', false);
  if (allowFuture) return;

  const today = new Date();
  const todayEnd = new Date(Date.UTC(today.getFullYear(), today.getMonth(), today.getDate(), 23, 59, 59));
  if (expenseDate > todayEnd) {
    throw new BusinessRuleError('An expense cannot be dated in the future.');
  }
}

/** §310: a receipt may be mandatory before a claim can be submitted. */
async function assertReceiptIfRequired(expenseId: string): Promise<void> {
  const required = await getSetting<boolean>('expense.receipt_required', false);
  if (!required) return;

  const count = await prisma.expenseReceipt.count({
    where: { expenseId, isDeleted: false },
  });
  if (count === 0) {
    throw new BusinessRuleError('A receipt is required before submitting this expense.');
  }
}

export async function createExpense(user: AuthUser, input: SubmitExpenseInput) {
  const category = await prisma.expenseCategory.findFirst({
    where: { id: input.expenseCategoryId, isDeleted: false, isActive: true },
    select: { id: true, name: true },
  });
  if (!category) throw new NotFoundError('Expense category not found.');

  const expenseDate = new Date(input.expenseDate);
  await assertValidExpenseDate(expenseDate);

  const expense = await prisma.$transaction(async (tx) => {
    const { key, prefix } = expenseNumberKey(expenseDate);
    const expenseNumber = await generateCode(tx, { key, prefix });

    const created = await tx.expense.create({
      data: {
        expenseNumber,
        employeeId: user.id,
        expenseCategoryId: input.expenseCategoryId,
        expenseDate,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        vendorName: input.vendorName,
        referenceNumber: input.referenceNumber,
        remarks: input.remarks,
        status: input.submit ? 'PENDING' : 'DRAFT',
        ...auditCreate(user.id),
      },
    });

    if (input.submit) {
      const outcome = await startApproval(tx, {
        module: EXPENSE_MODULE,
        referenceId: created.id,
        requesterId: user.id,
      });
      await tx.expense.update({
        where: { id: created.id },
        data: { approvalRequestId: outcome.approvalRequestId },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: 'CREATE',
        module: EXPENSE_MODULE,
        referenceId: created.id,
        newValue: { expenseNumber, amount: input.amount, status: created.status },
      },
      tx,
    );
    return created;
  });

  await logActivity({
    userId: user.id,
    activity: input.submit
      ? `Submitted expense ${expense.expenseNumber}`
      : `Saved draft expense ${expense.expenseNumber}`,
    module: EXPENSE_MODULE,
    referenceId: expense.id,
  });
  return expense;
}

/** Edit a draft, optionally submitting it (§311 — only drafts are editable). */
export async function updateExpense(user: AuthUser, id: string, input: SubmitExpenseInput) {
  const existing = await prisma.expense.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeId: true, status: true, expenseNumber: true },
  });
  if (!existing) throw new NotFoundError('Expense not found.');
  if (existing.employeeId !== user.id) {
    throw new ForbiddenError('You can only edit your own expenses.');
  }
  if (!EDITABLE_STATUSES.includes(existing.status)) {
    throw new BusinessRuleError('Only draft expenses can be edited.');
  }

  const expenseDate = new Date(input.expenseDate);
  await assertValidExpenseDate(expenseDate);
  if (input.submit) await assertReceiptIfRequired(id);

  const expense = await prisma.$transaction(async (tx) => {
    const updated = await tx.expense.update({
      where: { id },
      data: {
        expenseCategoryId: input.expenseCategoryId,
        expenseDate,
        amount: input.amount,
        currency: input.currency,
        description: input.description,
        vendorName: input.vendorName,
        referenceNumber: input.referenceNumber,
        remarks: input.remarks,
        status: input.submit ? 'PENDING' : 'DRAFT',
        ...auditUpdate(user.id),
      },
    });

    if (input.submit) {
      const outcome = await startApproval(tx, {
        module: EXPENSE_MODULE,
        referenceId: id,
        requesterId: user.id,
      });
      await tx.expense.update({
        where: { id },
        data: { approvalRequestId: outcome.approvalRequestId },
      });
    }

    await logAudit(
      { userId: user.id, action: 'UPDATE', module: EXPENSE_MODULE, referenceId: id, newValue: { status: updated.status } },
      tx,
    );
    return updated;
  });

  await logActivity({
    userId: user.id,
    activity: `Updated expense ${existing.expenseNumber}`,
    module: EXPENSE_MODULE,
    referenceId: id,
  });
  return expense;
}

/** Approve or reject via the engine (§307). */
export async function decideExpense(
  user: AuthUser,
  id: string,
  decision: ApprovalDecision,
  remarks?: string,
) {
  const expense = await prisma.expense.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, expenseNumber: true, status: true, approvalRequestId: true },
  });
  if (!expense) throw new NotFoundError('Expense not found.');
  if (expense.status !== 'PENDING') {
    throw new BusinessRuleError('Only pending expenses can be approved or rejected.');
  }
  if (!expense.approvalRequestId) {
    throw new BusinessRuleError('This expense has no approval workflow attached.');
  }

  await prisma.$transaction(async (tx) => {
    const outcome = await recordApprovalDecision(
      tx,
      user,
      expense.approvalRequestId as string,
      decision,
      remarks,
    );

    if (outcome.status === 'APPROVED' || outcome.status === 'REJECTED') {
      await tx.expense.update({
        where: { id },
        data: {
          status: outcome.status,
          approvedBy: user.id,
          approvedAt: new Date(),
          approvalRemarks: remarks,
          ...auditUpdate(user.id),
        },
      });
    }

    await logAudit(
      {
        userId: user.id,
        action: decision === 'APPROVED' ? 'EXPENSE_APPROVE' : 'EXPENSE_REJECT',
        module: EXPENSE_MODULE,
        referenceId: id,
        newValue: { expenseNumber: expense.expenseNumber, remarks, outcome: outcome.status },
      },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `${decision === 'APPROVED' ? 'Approved' : 'Rejected'} expense ${expense.expenseNumber}`,
    module: EXPENSE_MODULE,
    referenceId: id,
  });
}

/**
 * Record reimbursement of an approved claim (§308). Moves APPROVED →
 * REIMBURSED and writes the matching Financial Transaction (§311) in the same
 * transaction, so the ledger can never drift from the claim.
 */
export async function reimburseExpense(
  user: AuthUser,
  id: string,
  input: ReimburseExpenseInput,
) {
  const expense = await prisma.expense.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      expenseNumber: true,
      employeeId: true,
      status: true,
      amount: true,
    },
  });
  if (!expense) throw new NotFoundError('Expense not found.');
  if (expense.status !== 'APPROVED') {
    throw new BusinessRuleError('Only approved expenses can be reimbursed.');
  }

  const paymentDate = new Date(input.paymentDate);

  await prisma.$transaction(async (tx) => {
    await tx.expense.update({
      where: { id },
      data: {
        status: 'REIMBURSED',
        reimbursedAt: paymentDate,
        reimbursedBy: user.id,
        reimbursementMethod: input.paymentMethod,
        reimbursementReference: input.referenceNumber,
        reimbursementRemarks: input.remarks,
        ...auditUpdate(user.id),
      },
    });

    // Append-only ledger entry (§311). A reimbursement is money out, so it is
    // recorded as a debit.
    const { transactionNumber } = await recordFinancialTransaction(tx, {
      type: 'EXPENSE_REIMBURSED',
      debit: expense.amount,
      expenseId: id,
      reference: input.referenceNumber ?? expense.expenseNumber,
      userId: user.id,
      occurredAt: paymentDate,
    });

    await logAudit(
      {
        userId: user.id,
        action: 'EXPENSE_REIMBURSE',
        module: EXPENSE_MODULE,
        referenceId: id,
        newValue: {
          expenseNumber: expense.expenseNumber,
          amount: expense.amount.toNumber(),
          method: input.paymentMethod,
          transactionNumber,
        },
      },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Reimbursed expense ${expense.expenseNumber}`,
    module: EXPENSE_MODULE,
    referenceId: id,
  });
}

/** Withdraw a draft or pending claim (§311). */
export async function cancelExpense(user: AuthUser, id: string, reason?: string) {
  const expense = await prisma.expense.findFirst({
    where: { id, isDeleted: false },
    select: {
      id: true,
      expenseNumber: true,
      employeeId: true,
      status: true,
      approvalRequestId: true,
    },
  });
  if (!expense) throw new NotFoundError('Expense not found.');

  const isOwner = expense.employeeId === user.id;
  if (!isOwner && !user.permissions.has('expense.cancel')) {
    throw new ForbiddenError('You can only cancel your own expenses.');
  }
  if (!CANCELLABLE_STATUSES.includes(expense.status)) {
    throw new BusinessRuleError('Only draft or pending expenses can be cancelled.');
  }

  await prisma.$transaction(async (tx) => {
    if (expense.approvalRequestId) {
      await cancelApproval(tx, expense.approvalRequestId, user.id, reason);
    }
    await tx.expense.update({
      where: { id },
      data: { status: 'CANCELLED', remarks: reason, ...auditUpdate(user.id) },
    });
    await logAudit(
      { userId: user.id, action: 'EXPENSE_CANCEL', module: EXPENSE_MODULE, referenceId: id, oldValue: { status: expense.status, reason } },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Cancelled expense ${expense.expenseNumber}`,
    module: EXPENSE_MODULE,
    referenceId: id,
  });
}
