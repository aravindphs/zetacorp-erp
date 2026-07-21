import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { employeeReportSchema } from '@/features/reports/report.schema';
import { getEmployeeReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  KpiCards,
  ReportActions,
} from '@/features/reports/components/report-shell';
import { DistributionPieChart } from '@/features/reports/components/report-chart';
import { formatDateTime, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Employee Report' };

export default async function EmployeeReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.employees');
  const query = employeeReportSchema.parse(await searchParams);
  const data = await getEmployeeReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employee report"
        description="Headcount distribution and recent sign-ins."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="employees"
              canExport={hasPermission(user, 'report.export')}
            />
            <ButtonLink href="/reports" variant="outline" size="sm">
              All reports
            </ButtonLink>
          </div>
        }
      />

      <KpiCards
        items={[
          { label: 'Employees', value: formatNumber(data.employeeCount) },
          { label: 'Active', value: formatNumber(data.activeEmployees) },
          { label: 'Inactive', value: formatNumber(data.inactiveEmployees) },
        ]}
      />

      <div className="grid gap-6 lg:grid-cols-2">
        {data.byDepartment.length > 0 && (
          <DistributionPieChart
            title="By department"
            data={data.byDepartment.map((d) => ({ label: d.name, value: d.count }))}
          />
        )}
        {data.byRole.length > 0 && (
          <DistributionPieChart
            title="By role"
            data={data.byRole.map((r) => ({ label: r.name, value: r.count }))}
          />
        )}
      </div>

      <BreakdownTable
        title="Recent logins"
        columns={['Employee', 'Last login']}
        rows={data.recentLogins.map((u) => [
          `${u.fullName} (${u.employeeCode})`,
          u.lastLoginAt ? formatDateTime(u.lastLoginAt) : 'Never',
        ])}
      />
    </div>
  );
}
