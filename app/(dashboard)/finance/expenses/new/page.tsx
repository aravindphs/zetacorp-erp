import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getExpenseCategoryOptions } from '@/features/expense/expense.queries';
import { ExpenseForm } from '@/features/expense/components/expense-form';

export const metadata: Metadata = { title: 'Submit Expense' };

export default async function NewExpensePage() {
  await requirePermission('expense.create');
  const categories = await getExpenseCategoryOptions();

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Submit expense"
        description="Claim a business expense for reimbursement."
      />
      <ExpenseForm
        mode="create"
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
      />
    </div>
  );
}
