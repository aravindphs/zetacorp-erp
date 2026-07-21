import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { customerReportSchema } from '@/features/reports/report.schema';
import { getCustomerReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Customer Report' };

export default async function CustomerReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.customers');
  const query = customerReportSchema.parse(await searchParams);
  const data = await getCustomerReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customer report"
        description="Purchases, outstanding balances, and recent activity."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="customers"
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
          { label: 'Customers', value: formatNumber(data.customerCount) },
          { label: 'New in range', value: formatNumber(data.newCustomers) },
          { label: 'Active', value: formatNumber(data.activeCustomers) },
          { label: 'Outstanding', value: formatCurrency(data.outstandingBalance) },
        ]}
      />

      <BreakdownTable
        title="Top customers by business"
        columns={['Customer', 'Total purchases', 'Outstanding', 'Last purchase']}
        rows={data.rows.map((c) => [
          `${c.customerName} (${c.customerCode})`,
          formatCurrency(c.totalPurchases),
          formatCurrency(c.outstanding),
          c.lastPurchase ? formatDate(c.lastPurchase) : '—',
        ])}
      />
    </div>
  );
}
