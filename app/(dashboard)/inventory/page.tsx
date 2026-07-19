import type { Metadata } from 'next';
import { FolderTree, Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { productListQuerySchema } from '@/features/inventory/product.schema';
import { getProductList } from '@/features/inventory/product.service';
import { listCategories } from '@/features/category/category.service';
import { ProductTable } from '@/features/inventory/components/product-table';
import { ProductFilters } from '@/features/inventory/components/product-filters';
import { ProductExportButton } from '@/features/inventory/components/product-export-button';

export const metadata: Metadata = { title: 'Products' };

export default async function InventoryPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('inventory.view');
  const query = productListQuerySchema.parse(await searchParams);
  const [{ rows, meta }, categories] = await Promise.all([
    getProductList(query),
    listCategories(),
  ]);
  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Products"
        description="Manage products, pricing, and stock levels."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {hasPermission(user, 'category.view') && (
              <ButtonLink href="/inventory/categories" variant="outline" size="sm">
                <FolderTree className="size-4" /> Categories
              </ButtonLink>
            )}
            {hasPermission(user, 'inventory.export') && <ProductExportButton />}
            {hasPermission(user, 'inventory.create') && (
              <ButtonLink href="/inventory/new" size="sm">
                <Plus className="size-4" /> Add Product
              </ButtonLink>
            )}
          </div>
        }
      />

      <ProductFilters categories={categoryOptions} />

      <ProductTable
        rows={rows}
        meta={meta}
        canUpdate={hasPermission(user, 'inventory.update')}
        canAdjust={hasPermission(user, 'inventory.adjust')}
        canDelete={hasPermission(user, 'inventory.delete')}
      />
    </div>
  );
}
