import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { leaveReportSchema } from '@/features/reports/report.schema';
import { getLeaveReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { CategoryBarChart } from '@/features/reports/components/report-chart';
import { LEAVE_STATUS_LABELS } from '@/features/leave/leave.types';
import { formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Leave Report' };

export default async function LeaveReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.leaves');
  const query = leaveReportSchema.parse(await searchParams);
  const data = await getLeaveReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave report"
        description="Leave volume by status, type, and department."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="leaves"
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
          { label: 'Approved', value: formatNumber(data.approved) },
          { label: 'Pending', value: formatNumber(data.pending) },
          { label: 'Rejected', value: formatNumber(data.rejected) },
          { label: 'Total days', value: formatNumber(data.totalDays) },
        ]}
      />

      {data.byDepartment.length > 0 && (
        <CategoryBarChart
          title="Leave days by department"
          data={data.byDepartment.map((d) => ({ label: d.name, value: d.days }))}
          currency={false}
        />
      )}

      <div className="grid gap-6 lg:grid-cols-2">
        <BreakdownTable
          title="By status"
          columns={['Status', 'Requests', 'Days']}
          rows={data.byStatus.map((s) => [
            LEAVE_STATUS_LABELS[s.status],
            formatNumber(s.count),
            formatNumber(s.days),
          ])}
        />
        <BreakdownTable
          title="By leave type"
          columns={['Type', 'Requests', 'Days']}
          rows={data.byType.map((t) => [t.name, formatNumber(t.count), formatNumber(t.days)])}
        />
      </div>
    </div>
  );
}
