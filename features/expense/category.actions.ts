'use server';

import { z } from 'zod';
import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { nonEmptyString, optionalString } from '@/schemas/common';
import {
  createExpenseCategory,
  deleteExpenseCategory,
  updateExpenseCategory,
} from '@/features/expense/category.service';

const CATEGORIES_PATH = '/finance/expenses/categories';

const categorySchema = z.object({
  name: nonEmptyString(100),
  description: optionalString(500),
  isActive: z.boolean().default(true),
});

export async function createExpenseCategoryAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.category.manage');
    const data = categorySchema.parse(input);
    const category = await createExpenseCategory(user, data);
    revalidatePath(CATEGORIES_PATH);
    return actionOk({ id: category.id }, 'Category created.');
  });
}

export async function updateExpenseCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.category.manage');
    const data = categorySchema.parse(input);
    const category = await updateExpenseCategory(user, id, data);
    revalidatePath(CATEGORIES_PATH);
    return actionOk({ id: category.id }, 'Category updated.');
  });
}

export async function deleteExpenseCategoryAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('expense.category.manage');
    await deleteExpenseCategory(user, id);
    revalidatePath(CATEGORIES_PATH);
    return actionOk(null, 'Category deleted.');
  });
}
