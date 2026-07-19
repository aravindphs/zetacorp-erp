'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { categorySchema } from '@/features/category/category.schema';
import {
  createCategory,
  deleteCategory,
  updateCategory,
} from '@/features/category/category.service';

export async function createCategoryAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('category.create');
    const data = categorySchema.parse(input);
    const category = await createCategory(user, data);
    revalidatePath('/inventory/categories');
    return actionOk({ id: category.id }, 'Category created.');
  });
}

export async function updateCategoryAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('category.update');
    const data = categorySchema.parse(input);
    const category = await updateCategory(user, id, data);
    revalidatePath('/inventory/categories');
    return actionOk({ id: category.id }, 'Category updated.');
  });
}

export async function deleteCategoryAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('category.delete');
    await deleteCategory(user, id);
    revalidatePath('/inventory/categories');
    return actionOk(null, 'Category deleted.');
  });
}
