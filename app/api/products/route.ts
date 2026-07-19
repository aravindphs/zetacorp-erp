import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { createProductSchema, productListQuerySchema } from '@/features/inventory/product.schema';
import { createProduct, getProductList } from '@/features/inventory/product.service';

export const dynamic = 'force-dynamic';

export const GET = withApiHandler(async (request, requestId) => {
  await requirePermission('inventory.view');
  const query = productListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const { rows, meta } = await getProductList(query);
  return apiSuccess(rows, { message: 'Products', meta, requestId });
});

export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('inventory.create');
  const data = createProductSchema.parse(await request.json());
  const product = await createProduct(user, data);
  return apiSuccess(
    { id: product.id, productCode: product.productCode },
    { message: 'Product created', status: HttpStatus.CREATED, requestId },
  );
});
