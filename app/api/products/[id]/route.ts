import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema, deleteReasonSchema } from '@/schemas/common';
import { updateProductSchema } from '@/features/inventory/product.schema';
import { deleteProduct, updateProduct } from '@/features/inventory/product.service';
import { getProductDetail } from '@/features/inventory/product.repository';
import { NotFoundError } from '@/lib/errors';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('inventory.view');
  const { id } = await ctx.params;
  const product = await getProductDetail(uuidSchema.parse(id));
  if (!product) throw new NotFoundError('Product not found.');
  return apiSuccess(product, { message: 'Product', requestId });
});

export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('inventory.update');
  const { id } = await ctx.params;
  const data = updateProductSchema.parse(await request.json());
  const product = await updateProduct(user, uuidSchema.parse(id), data);
  return apiSuccess({ id: product.id }, { message: 'Product updated', requestId });
});

export const DELETE = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('inventory.delete');
  const { id } = await ctx.params;
  const { reason } = deleteReasonSchema.parse(await request.json().catch(() => ({})));
  await deleteProduct(user, uuidSchema.parse(id), reason);
  return apiSuccess(null, { message: 'Product deleted', requestId });
});
