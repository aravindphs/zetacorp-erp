import type { Metadata } from 'next';
import { FolderTree, Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { Card, CardContent } from '@/components/ui/card';
import { expenseListQuerySchema } from '@/features/expense/expense.schema';
import {
  getExpenseCategoryOptions,
  getExpenseDashboard,
  getExpenseList,
} from '@/features/expense/expense.queries';
import { ExpenseTable } from '@/features/expense/components/expense-table';
import { ExpenseFilters } from '@/features/expense/components/expense-filters';
import { formatCurrency } from '@/utils/format';

export const metadata: Metadata = { title: 'Expenses' };

export default async function ExpensesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('expense.view');
  const query = expenseListQuerySchema.parse(await searchParams);

  const [dashboard, { rows, meta }, categories] = await Promise.all([
    getExpenseDashboard(),
    getExpenseList(query, user),
    getExpenseCategoryOptions(),
  ]);

  const cards = [
    { label: 'Pending', value: String(dashboard.pending) },
    { label: 'Approved this month', value: String(dashboard.approvedThisMonth) },
    { label: 'Rejected this month', value: String(dashboard.rejectedThisMonth) },
    { label: 'Reimbursed this month', value: String(dashboard.reimbursedThisMonth) },
    { label: 'Total claimed', value: formatCurrency(dashboard.totalClaimAmount) },
    { label: 'Total reimbursed', value: formatCurrency(dashboard.totalReimbursedAmount) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expenses"
        description="Submit claims, approve them, and record reimbursements."
        actions={
          <div className="flex items-center gap-2">
            {hasPermission(user, 'expense.category.manage') && (
              <ButtonLink href="/finance/expenses/categories" variant="outline" size="sm">
                <FolderTree className="size-4" /> Categories
              </ButtonLink>
            )}
            {hasPermission(user, 'expense.create') && (
              <ButtonLink href="/finance/expenses/new" size="sm">
                <Plus className="size-4" /> Submit Expense
              </ButtonLink>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {dashboard.categoryBreakdown.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Category breakdown</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {dashboard.categoryBreakdown.slice(0, 6).map((c) => (
                  <tr key={c.categoryName}>
                    <td className="px-3 py-2">{c.categoryName}</td>
                    <td className="px-3 py-2 text-right font-medium tabular-nums">
                      {formatCurrency(c.amount)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink
          href="/finance/expenses?mine=true"
          variant={query.mine ? 'default' : 'outline'}
          size="sm"
        >
          My expenses
        </ButtonLink>
        <ButtonLink
          href="/finance/expenses?pendingMine=true"
          variant={query.pendingMine ? 'default' : 'outline'}
          size="sm"
        >
          Pending my approval
        </ButtonLink>
        <ButtonLink
          href="/finance/expenses"
          variant={query.mine || query.pendingMine ? 'outline' : 'default'}
          size="sm"
        >
          All claims
        </ButtonLink>
      </div>

      <ExpenseFilters categories={categories.map((c) => ({ id: c.id, name: c.name }))} />
      <ExpenseTable
        rows={rows}
        meta={meta}
        showEmployee={!query.mine}
        emptyTitle={
          query.pendingMine
            ? 'There are no expenses awaiting approval.'
            : query.mine
              ? "You haven't submitted any expenses."
              : 'No expenses found'
        }
        emptyDescription={
          query.mine ? 'Submit a claim to get started.' : 'Adjust your filters to see more.'
        }
      />
    </div>
  );
}
