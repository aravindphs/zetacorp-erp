import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { inventoryReportSchema } from '@/features/reports/report.schema';
import { getInventoryReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { CategoryBarChart } from '@/features/reports/components/report-chart';
import { formatCurrency, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Inventory Report' };

export default async function InventoryReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.inventory');
  const query = inventoryReportSchema.parse(await searchParams);
  const data = await getInventoryReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Inventory report"
        description="Stock on hand, inventory value, and movement."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="inventory"
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
          { label: 'Products', value: formatNumber(data.productCount) },
          { label: 'Inventory value', value: formatCurrency(data.inventoryValue) },
          { label: 'Low stock', value: formatNumber(data.lowStockCount) },
          { label: 'Out of stock', value: formatNumber(data.outOfStockCount) },
        ]}
      />

      {data.fastMoving.length > 0 && (
        <CategoryBarChart
          title="Fast moving products (units sold)"
          data={data.fastMoving.map((p) => ({ label: p.productName, value: p.quantitySold }))}
          currency={false}
        />
      )}

      <BreakdownTable
        title="Stock levels (lowest first)"
        columns={['Product', 'In stock', 'Minimum', 'Stock value']}
        rows={data.rows.map((p) => [
          `${p.productName} (${p.productCode})`,
          formatNumber(p.currentStock),
          formatNumber(p.minimumStock),
          formatCurrency(p.stockValue),
        ])}
      />
    </div>
  );
}
