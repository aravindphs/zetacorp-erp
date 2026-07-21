import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { Badge } from '@/components/ui/badge';
import { auditReportSchema } from '@/features/reports/report.schema';
import { getAuditReport } from '@/features/reports/report.queries';
import {
  BreakdownTable,
  ReportActions,
  ReportRangeFilter,
} from '@/features/reports/components/report-shell';
import { formatDateTime, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Audit Report' };

export default async function AuditReportPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('report.audit');
  const query = auditReportSchema.parse(await searchParams);
  const data = await getAuditReport(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit report"
        description="Security-sensitive actions: role changes, cancellations, and settings edits."
        actions={
          <div className="flex items-center gap-2">
            <ReportActions
              report="audit"
              canExport={hasPermission(user, 'report.export')}
            />
            <ButtonLink href="/reports" variant="outline" size="sm">
              All reports
            </ButtonLink>
          </div>
        }
      />

      <ReportRangeFilter />

      <BreakdownTable
        title="Most frequent actions"
        columns={['Action', 'Count']}
        rows={data.byAction.map((a) => [a.action, formatNumber(a.count)])}
      />

      <div>
        <h2 className="mb-2 text-sm font-semibold">
          Audit trail{' '}
          <span className="font-normal text-muted-foreground">
            ({formatNumber(data.meta.totalItems)} entries)
          </span>
        </h2>
        {data.rows.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No records found for the selected filters.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Action</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Actor</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {data.rows.map((r) => (
                  <tr key={r.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateTime(r.createdAt)}
                    </td>
                    <td className="px-3 py-2 font-medium">{r.action}</td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{r.module}</Badge>
                    </td>
                    <td className="px-3 py-2">{r.userName}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <p className="mt-2 text-xs text-muted-foreground">
          Page {data.meta.page} of {data.meta.totalPages}
        </p>
      </div>
    </div>
  );
}
