'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { uuidSchema } from '@/schemas/common';
import { ValidationError } from '@/lib/errors';
import {
  cancelExpenseSchema,
  expenseDecisionSchema,
  reimburseExpenseSchema,
  submitExpenseSchema,
  updateExpenseSchema,
} from '@/features/expense/expense.schema';
import {
  cancelExpense,
  createExpense,
  decideExpense,
  reimburseExpense,
  updateExpense,
} from '@/features/expense/expense.service';
import {
  deleteExpenseReceipt,
  getReceiptDownloadUrl,
  parseReceiptType,
  uploadExpenseReceipt,
} from '@/features/expense/receipt.service';

const LIST_PATH = '/finance/expenses';

export async function createExpenseAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.create');
    const data = submitExpenseSchema.parse(input);
    const expense = await createExpense(user, data);
    revalidatePath(LIST_PATH);
    return actionOk(
      { id: expense.id },
      data.submit ? `Expense ${expense.expenseNumber} submitted.` : 'Draft saved.',
    );
  });
}

export async function updateExpenseAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.update');
    const data = updateExpenseSchema.parse(input);
    const expense = await updateExpense(user, id, data);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk({ id: expense.id }, data.submit ? 'Expense submitted.' : 'Draft updated.');
  });
}

export async function approveExpenseAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.approve');
    const { remarks } = expenseDecisionSchema.parse(input);
    await decideExpense(user, id, 'APPROVED', remarks);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Expense approved.');
  });
}

export async function rejectExpenseAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.reject');
    const { remarks } = expenseDecisionSchema.parse(input);
    await decideExpense(user, id, 'REJECTED', remarks);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Expense rejected.');
  });
}

export async function reimburseExpenseAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.reimburse');
    const data = reimburseExpenseSchema.parse(input);
    await reimburseExpense(user, id, data);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Reimbursement recorded.');
  });
}

export async function cancelExpenseAction(id: string, input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    // Ownership is enforced in the service for callers without expense.cancel.
    const user = await requirePermission('expense.view');
    const { reason } = cancelExpenseSchema.parse(input);
    await cancelExpense(user, id, reason);
    revalidatePath(LIST_PATH);
    revalidatePath(`${LIST_PATH}/${id}`);
    return actionOk(null, 'Expense cancelled.');
  });
}

// --- Receipts (§305) ------------------------------------------------------

export async function uploadReceiptAction(
  formData: FormData,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.create');
    const expenseId = uuidSchema.parse(formData.get('expenseId'));
    const receiptType = parseReceiptType(formData.get('receiptType'));
    const file = formData.get('file');
    if (!(file instanceof File)) throw new ValidationError('Select a file to upload.');

    const receipt = await uploadExpenseReceipt(user, { expenseId, receiptType, file });
    revalidatePath(`${LIST_PATH}/${expenseId}`);
    return actionOk({ id: receipt.id }, 'Receipt uploaded.');
  });
}

export async function getReceiptUrlAction(
  receiptId: string,
): Promise<ActionResult<{ url: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.view');
    const url = await getReceiptDownloadUrl(user, uuidSchema.parse(receiptId));
    return actionOk({ url }, 'Link ready.');
  });
}

export async function deleteReceiptAction(
  receiptId: string,
  expenseId: string,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.create');
    await deleteExpenseReceipt(user, uuidSchema.parse(receiptId));
    revalidatePath(`${LIST_PATH}/${expenseId}`);
    return actionOk(null, 'Receipt removed.');
  });
}
