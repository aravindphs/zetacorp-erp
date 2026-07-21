import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { listExpenseCategories } from '@/features/expense/category.service';
import { ExpenseCategoryManager } from '@/features/expense/components/category-manager';

export const metadata: Metadata = { title: 'Expense Categories' };

export default async function ExpenseCategoriesPage() {
  const user = await requirePermission('expense.view');
  const categories = await listExpenseCategories();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Expense categories"
        description="Categories available when submitting a claim."
        actions={
          <ButtonLink href="/finance/expenses" variant="outline" size="sm">
            Back to expenses
          </ButtonLink>
        }
      />
      <ExpenseCategoryManager
        categories={categories}
        canManage={hasPermission(user, 'expense.category.manage')}
      />
    </div>
  );
}
