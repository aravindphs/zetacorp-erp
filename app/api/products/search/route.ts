import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getProductOptions } from '@/features/inventory/product.service';

export const dynamic = 'force-dynamic';

/** GET /api/products/search?q= — active product options for line pickers (§148). */
export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('inventory.view');
  const q = new URL(request.url).searchParams.get('q') ?? '';
  const options = await getProductOptions(q);
  return apiSuccess(options, { message: 'Products', requestId });
});
