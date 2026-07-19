import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { EmptyState } from '@/components/shared/page-states';
import { listCategories } from '@/features/category/category.service';
import { ProductForm } from '@/features/inventory/components/product-form';

export const metadata: Metadata = { title: 'Add Product' };

export default async function NewProductPage() {
  await requirePermission('inventory.create');
  const categories = (await listCategories(false)).map((c) => ({ id: c.id, name: c.name }));

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Add product" description="Create a new product and set opening stock." />
      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create a category before adding products."
          action={<ButtonLink href="/inventory/categories" size="sm">Manage categories</ButtonLink>}
        />
      ) : (
        <ProductForm mode="create" categories={categories} />
      )}
    </div>
  );
}
