import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { expenseReportSchema } from '@/features/reports/report.schema';
import { getExpenseReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { DistributionPieChart, TrendChart } from '@/features/reports/components/report-chart';
import { EXPENSE_STATUS_LABELS } from '@/features/expense/expense.types';
import { formatCurrency, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Expense Report' };

export default async function ExpenseReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.expenses');
  const query = expenseReportSchema.parse(await searchParams);
  const data = await getExpenseReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Expense report"
        description="Claim amounts by status and category, with monthly trend."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="expenses"
              canExport={hasPermission(user, 'report.export')}
            />
            <ButtonLink href="/reports" variant="outline" size="sm">
              All reports
            </ButtonLink>
          </div>
        }
      />

      <ReportRangeFilter />

      <KpiCards
        items={[
          { label: 'Submitted', value: formatCurrency(data.submittedAmount) },
          { label: 'Approved', value: formatCurrency(data.approvedAmount) },
          { label: 'Rejected', value: formatCurrency(data.rejectedAmount) },
          { label: 'Reimbursed', value: formatCurrency(data.reimbursedAmount) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {data.trend.length > 0 && (
          <TrendChart
            title="Monthly expense trend"
            data={data.trend.map((t) => ({ label: t.month, value: t.total }))}
          />
        )}
        {data.byCategory.length > 0 && (
          <DistributionPieChart
            title="By category"
            data={data.byCategory.map((c) => ({ label: c.name, value: c.total }))}
            currency
          />
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="By status"
          columns={['Status', 'Claims', 'Amount']}
          rows={data.byStatus.map((s) => [
            EXPENSE_STATUS_LABELS[s.status],
            formatNumber(s.count),
            formatCurrency(s.total),
          ])}
        />
        <BreakdownTable
          title="By category"
          columns={['Category', 'Claims', 'Amount']}
          rows={data.byCategory.map((c) => [
            c.name,
            formatNumber(c.count),
            formatCurrency(c.total),
          ])}
        />
      </div>
    </div>
  );
}
