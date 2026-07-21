import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { paymentReportSchema } from '@/features/reports/report.schema';
import { getPaymentReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { DistributionPieChart } from '@/features/reports/components/report-chart';
import { PAYMENT_METHOD_LABELS } from '@/features/payment/payment.types';
import { formatCurrency, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Payment Report' };

export default async function PaymentReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.payments');
  const query = paymentReportSchema.parse(await searchParams);
  const data = await getPaymentReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payment report"
        description="Collections by method, with outstanding balances."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="payments"
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
          { label: 'Payments', value: formatNumber(data.paymentCount) },
          { label: 'Collected', value: formatCurrency(data.collectionAmount) },
          { label: 'Average payment', value: formatCurrency(data.averagePayment) },
          { label: 'Still outstanding', value: formatCurrency(data.outstandingCollection) },
        ]}
      />

      {data.byMethod.length > 0 && (
        <DistributionPieChart
          title="Collections by method"
          data={data.byMethod.map((m) => ({
            label: PAYMENT_METHOD_LABELS[m.method],
            value: m.total,
          }))}
          currency
        />
      )}

      <BreakdownTable
        title="Payment methods"
        columns={['Method', 'Count', 'Total']}
        rows={data.byMethod.map((m) => [
          PAYMENT_METHOD_LABELS[m.method],
          formatNumber(m.count),
          formatCurrency(m.total),
        ])}
      />
    </div>
  );
}
