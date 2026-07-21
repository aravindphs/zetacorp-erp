import 'server-only';

/**
 * Expense receipts (spec §305, §316). Same private-bucket + signed-URL pattern
 * as employee documents: only the object path is persisted, and a failed
 * database write rolls the uploaded object back so storage keeps no orphans.
 */
import { ExpenseReceiptType } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { auditCreate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { BusinessRuleError, ForbiddenError, NotFoundError, ValidationError } from '@/lib/errors';
import {
  createSignedUrl,
  removeFile,
  sanitizeFileName,
  uploadFile,
} from '@/services/storage.service';
import { RECEIPT_ALLOWED_MIME, RECEIPT_MAX_BYTES } from '@/features/expense/expense.types';
import type { AuthUser } from '@/types/auth';

/** Receipts may only be attached while the claim is still the owner's to edit. */
async function assertCanAttach(user: AuthUser, expenseId: string) {
  const expense = await prisma.expense.findFirst({
    where: { id: expenseId, isDeleted: false },
    select: { id: true, employeeId: true, status: true, expenseNumber: true },
  });
  if (!expense) throw new NotFoundError('Expense not found.');
  if (expense.employeeId !== user.id) {
    throw new ForbiddenError('You can only attach receipts to your own expenses.');
  }
  if (expense.status !== 'DRAFT' && expense.status !== 'PENDING') {
    throw new BusinessRuleError('Receipts can only be attached before a claim is decided.');
  }
  return expense;
}

export async function uploadExpenseReceipt(
  user: AuthUser,
  input: { expenseId: string; receiptType: ExpenseReceiptType; file: File },
) {
  const expense = await assertCanAttach(user, input.expenseId);

  const { file } = input;
  if (!file || file.size === 0) throw new ValidationError('Select a file to upload.');
  if (file.size > RECEIPT_MAX_BYTES) {
    throw new ValidationError('File is larger than the 10 MB limit.');
  }
  if (!RECEIPT_ALLOWED_MIME.includes(file.type as (typeof RECEIPT_ALLOWED_MIME)[number])) {
    throw new ValidationError('Only PDF, PNG, JPG and JPEG files are allowed.');
  }

  const safeName = sanitizeFileName(file.name);
  const storagePath = `expense-receipts/${expense.id}/${Date.now()}-${safeName}`;
  const bytes = new Uint8Array(await file.arrayBuffer());

  await uploadFile(storagePath, bytes, file.type);

  try {
    const receipt = await prisma.expenseReceipt.create({
      data: {
        expenseId: expense.id,
        receiptType: input.receiptType,
        fileName: safeName,
        storagePath,
        mimeType: file.type,
        fileSize: file.size,
        ...auditCreate(user.id),
      },
    });

    await logActivity({
      userId: user.id,
      activity: `Attached receipt ${safeName} to ${expense.expenseNumber}`,
      module: 'expense',
      referenceId: expense.id,
    });
    return receipt;
  } catch (error) {
    // Roll the object back so a failed insert leaves nothing behind (§316).
    await removeFile(storagePath).catch(() => undefined);
    throw error;
  }
}

export function listExpenseReceipts(expenseId: string) {
  return prisma.expenseReceipt.findMany({
    where: { expenseId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
  });
}

/** Short-lived download link for a private receipt (§305). */
export async function getReceiptDownloadUrl(user: AuthUser, receiptId: string): Promise<string> {
  const receipt = await prisma.expenseReceipt.findFirst({
    where: { id: receiptId, isDeleted: false },
    select: { id: true, storagePath: true, fileName: true, expenseId: true },
  });
  if (!receipt) throw new NotFoundError('Receipt not found.');

  const url = await createSignedUrl(receipt.storagePath);
  await logActivity({
    userId: user.id,
    activity: `Downloaded receipt ${receipt.fileName}`,
    module: 'expense',
    referenceId: receipt.expenseId,
  });
  return url;
}

export async function deleteExpenseReceipt(user: AuthUser, receiptId: string) {
  const receipt = await prisma.expenseReceipt.findFirst({
    where: { id: receiptId, isDeleted: false },
    select: { id: true, fileName: true, storagePath: true, expenseId: true },
  });
  if (!receipt) throw new NotFoundError('Receipt not found.');
  await assertCanAttach(user, receipt.expenseId);

  await prisma.expenseReceipt.update({
    where: { id: receiptId },
    data: { ...softDelete(user.id) },
  });
  await removeFile(receipt.storagePath).catch(() => undefined);

  await logActivity({
    userId: user.id,
    activity: `Removed receipt ${receipt.fileName}`,
    module: 'expense',
    referenceId: receipt.expenseId,
  });
}

/** Guard used by the upload action to validate the incoming enum value. */
export function parseReceiptType(value: unknown): ExpenseReceiptType {
  if (typeof value === 'string' && value in ExpenseReceiptType) {
    return value as ExpenseReceiptType;
  }
  return 'RECEIPT';
}
