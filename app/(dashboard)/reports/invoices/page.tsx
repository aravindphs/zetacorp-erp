import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { invoiceReportSchema } from '@/features/reports/report.schema';
import { getInvoiceReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { PAYMENT_STATUS_LABELS } from '@/features/invoice/invoice.types';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Invoice Report' };

export default async function InvoiceReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.invoices');
  const query = invoiceReportSchema.parse(await searchParams);
  const data = await getInvoiceReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoice report"
        description="Invoice register with GST, status, and outstanding amounts."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="invoices"
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
          { label: 'Invoices', value: formatNumber(data.invoiceCount) },
          { label: 'Total value', value: formatCurrency(data.totalAmount) },
          { label: 'GST', value: formatCurrency(data.totalGst) },
          { label: 'Outstanding', value: formatCurrency(data.totalOutstanding) },
        ]}
      />

      <BreakdownTable
        title="By payment status"
        columns={['Payment status', 'Count', 'Value']}
        rows={data.byPaymentStatus.map((s) => [
          PAYMENT_STATUS_LABELS[s.status],
          formatNumber(s.count),
          formatCurrency(s.total),
        ])}
      />

      <BreakdownTable
        title="Invoices in range (latest 100)"
        columns={['Invoice', 'Customer', 'Date', 'Due', 'Total', 'Outstanding']}
        rows={data.rows.map((i) => [
          i.invoiceNumber,
          i.customerName,
          formatDate(i.invoiceDate),
          i.dueDate ? formatDate(i.dueDate) : '—',
          formatCurrency(i.grandTotal),
          formatCurrency(i.balanceDue),
        ])}
      />
    </div>
  );
}
