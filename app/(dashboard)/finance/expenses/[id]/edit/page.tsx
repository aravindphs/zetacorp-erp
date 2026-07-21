import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getExpenseCategoryOptions, getExpenseDetail } from '@/features/expense/expense.queries';
import { ExpenseForm } from '@/features/expense/components/expense-form';
import { EDITABLE_STATUSES } from '@/features/expense/expense.types';
import type { ExpenseFormInput } from '@/features/expense/expense.schema';

export const metadata: Metadata = { title: 'Edit Expense' };

export default async function EditExpensePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('expense.update');
  const { id } = await params;

  const [expense, categories] = await Promise.all([
    getExpenseDetail(id),
    getExpenseCategoryOptions(),
  ]);
  if (!expense) notFound();

  // Only the owner's own drafts are editable (§311) — bounce anything else back
  // rather than rendering a form that cannot save.
  if (expense.employeeId !== user.id || !EDITABLE_STATUSES.includes(expense.status)) {
    redirect(`/finance/expenses/${id}`);
  }

  const defaultValues: Partial<ExpenseFormInput> = {
    expenseCategoryId: expense.expenseCategoryId,
    expenseDate: expense.expenseDate.toISOString().slice(0, 10),
    amount: expense.amount.toNumber(),
    currency: expense.currency,
    description: expense.description ?? undefined,
    vendorName: expense.vendorName ?? undefined,
    referenceNumber: expense.referenceNumber ?? undefined,
    remarks: expense.remarks ?? undefined,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit ${expense.expenseNumber}`}
        description="Update this draft, then save it or submit it for approval."
      />
      <ExpenseForm
        mode="edit"
        expenseId={expense.id}
        categories={categories.map((c) => ({ id: c.id, name: c.name }))}
        defaultValues={defaultValues}
      />
    </div>
  );
}
