import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { logActivity } from '@/services/activity-log.service';
import { toCsv } from '@/utils/csv';
import { productListQuerySchema } from '@/features/inventory/product.schema';
import { listProductsForExport } from '@/features/inventory/product.repository';

export const dynamic = 'force-dynamic';

/** GET /api/products/export — CSV honouring current filters (spec §150). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('inventory.export');
  const query = productListQuerySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  const products = await listProductsForExport(query);

  const headers = [
    'Code', 'Name', 'Brand', 'Model', 'Category', 'HSN', 'SKU', 'Unit',
    'Purchase Price', 'Selling Price', 'GST %', 'Current Stock', 'Min Stock', 'Status',
  ];
  const rows = products.map((p) => [
    p.productCode, p.productName, p.brand, p.model, p.category.name, p.hsnCode, p.sku, p.unit,
    p.purchasePrice.toNumber(), p.sellingPrice.toNumber(), p.gstPercentage.toNumber(),
    p.currentStock.toNumber(), p.minimumStock.toNumber(), p.status,
  ]);

  await logActivity({ userId: user.id, activity: `Exported ${products.length} products`, module: 'inventory' });

  return new NextResponse(toCsv(headers, rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="products-${new Date().toISOString().slice(0, 10)}.csv"`,
      'x-request-id': requestId,
    },
  });
});
