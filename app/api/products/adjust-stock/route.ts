import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { adjustStockSchema } from '@/features/inventory/product.schema';
import { adjustStock } from '@/features/inventory/product.service';

export const dynamic = 'force-dynamic';

/** POST /api/products/adjust-stock (spec §145, §152). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('inventory.adjust');
  const data = adjustStockSchema.parse(await request.json());
  const result = await adjustStock(user, data);
  return apiSuccess(result, { message: 'Stock adjusted', requestId });
});
