import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { listCategories } from '@/features/category/category.service';
import { CategoryManager } from '@/features/category/components/category-manager';

export const metadata: Metadata = { title: 'Categories' };

export default async function CategoriesPage() {
  const user = await requirePermission('category.view');
  const categories = await listCategories();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Product categories"
        description="Organise products into categories."
        actions={
          <ButtonLink href="/inventory" variant="outline" size="sm">
            Back to products
          </ButtonLink>
        }
      />
      <CategoryManager
        categories={categories}
        perms={{
          canCreate: hasPermission(user, 'category.create'),
          canUpdate: hasPermission(user, 'category.update'),
          canDelete: hasPermission(user, 'category.delete'),
        }}
      />
    </div>
  );
}
