'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { deleteReasonSchema } from '@/schemas/common';
import {
  adjustStockSchema,
  createProductSchema,
  updateProductSchema,
} from '@/features/inventory/product.schema';
import {
  adjustStock,
  createProduct,
  deleteProduct,
  updateProduct,
} from '@/features/inventory/product.service';

export async function createProductAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('inventory.create');
    const data = createProductSchema.parse(input);
    const product = await createProduct(user, data);
    revalidatePath('/inventory');
    return actionOk({ id: product.id }, `Product ${product.productCode} created.`);
  });
}

export async function updateProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('inventory.update');
    const data = updateProductSchema.parse(input);
    const product = await updateProduct(user, id, data);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${id}`);
    return actionOk({ id: product.id }, 'Product updated.');
  });
}

export async function adjustStockAction(input: unknown): Promise<ActionResult<{ stockAfter: number }>> {
  return handleAction(async () => {
    const user = await requirePermission('inventory.adjust');
    const data = adjustStockSchema.parse(input);
    const result = await adjustStock(user, data);
    revalidatePath('/inventory');
    revalidatePath(`/inventory/${data.productId}`);
    return actionOk({ stockAfter: result.stockAfter }, 'Stock adjusted.');
  });
}

export async function deleteProductAction(
  id: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('inventory.delete');
    const { reason } = deleteReasonSchema.parse(input);
    await deleteProduct(user, id, reason);
    revalidatePath('/inventory');
    return actionOk(null, 'Product deleted.');
  });
}
