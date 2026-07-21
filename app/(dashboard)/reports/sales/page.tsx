import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { salesReportSchema } from '@/features/reports/report.schema';
import { getSalesReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { TrendChart } from '@/features/reports/components/report-chart';
import { formatCurrency, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Sales Report' };

export default async function SalesReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.sales');
  const query = salesReportSchema.parse(await searchParams);
  const data = await getSalesReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Sales report"
        description="Invoiced revenue, tax collected, and best sellers."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions report="sales" canExport={hasPermission(user, 'report.export')} />
            <ButtonLink href="/reports" variant="outline" size="sm">
              All reports
            </ButtonLink>
          </div>
        }
      />

      <ReportRangeFilter />

      <KpiCards
        items={[
          { label: 'Invoices', value: formatNumber(data.invoiceCount) },
          { label: 'Sales amount', value: formatCurrency(data.salesAmount) },
          { label: 'Tax collected', value: formatCurrency(data.taxCollected) },
          { label: 'Average invoice', value: formatCurrency(data.averageInvoiceValue) },
        ]}
      />

      {data.trend.length > 0 && (
        <TrendChart
          title="Monthly sales"
          data={data.trend.map((t) => ({ label: t.month, value: t.total }))}
        />
      )}

      <BreakdownTable
        title="Top selling products"
        columns={['Product', 'Quantity', 'Revenue']}
        rows={data.topProducts.map((p) => [
          p.productName,
          formatNumber(p.quantity),
          formatCurrency(p.total),
        ])}
      />
    </div>
  );
}
