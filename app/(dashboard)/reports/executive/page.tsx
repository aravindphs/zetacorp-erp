import type { Metadata } from 'next';
import Link from 'next/link';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { Badge } from '@/components/ui/badge';
import { getExecutiveReport } from '@/features/reports/report.queries';
import { KpiCards, BreakdownTable } from '@/features/reports/components/report-shell';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Executive Dashboard' };

export default async function ExecutiveReportPage() {
  await requirePermission('report.view');
  const data = await getExecutiveReport();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Executive dashboard"
        description="Revenue, collections, and pending work across the organisation."
        actions={
          <ButtonLink href="/reports" variant="outline" size="sm">
            All reports
          </ButtonLink>
        }
      />

      <KpiCards
        items={[
          { label: 'Revenue today', value: formatCurrency(data.revenueToday) },
          { label: 'Revenue this month', value: formatCurrency(data.revenueThisMonth) },
          { label: 'Revenue this year', value: formatCurrency(data.revenueThisYear) },
          { label: 'Outstanding', value: formatCurrency(data.outstandingAmount) },
          {
            label: 'Invoices this month',
            value: formatNumber(data.invoicesCreatedThisMonth),
          },
          {
            label: 'Payments this month',
            value: formatCurrency(data.paymentsReceivedThisMonth),
            hint: `${data.paymentCountThisMonth} payment${data.paymentCountThisMonth === 1 ? '' : 's'}`,
          },
          { label: 'Pending leave', value: formatNumber(data.pendingLeaveRequests) },
          { label: 'Pending expenses', value: formatNumber(data.pendingExpenseClaims) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="Top customers"
          columns={['Customer', 'Total business']}
          rows={data.topCustomers.map((c) => [c.customerName, formatCurrency(c.total)])}
        />
        <BreakdownTable
          title="Low stock items"
          columns={['Product', 'In stock', 'Minimum']}
          rows={data.lowStockItems.map((p) => [
            `${p.productName} (${p.productCode})`,
            formatNumber(p.currentStock),
            formatNumber(p.minimumStock),
          ])}
        />
      </div>

      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
        {data.recentActivities.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Who</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.recentActivities.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{a.module}</Badge>
                    </td>
                    <td className="px-3 py-2">{a.userName}</td>
                    <td className="px-3 py-2">{a.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <p className="text-sm text-muted-foreground">
        Need more detail? Open the{' '}
        <Link href="/reports" className="text-primary hover:underline">
          full report list
        </Link>
        .
      </p>
    </div>
  );
}
