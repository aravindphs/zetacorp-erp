import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { auditLogQuerySchema } from '@/features/admin/admin.schema';
import { getAuditLogs, getLogModules } from '@/features/admin/admin.queries';
import { LogFilters, LogPager } from '@/features/admin/components/log-filters';
import { formatDateTime, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Audit Logs' };

export default async function AuditLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('audit.view');
  const query = auditLogQuerySchema.parse(await searchParams);

  const [{ rows, meta }, modules] = await Promise.all([getAuditLogs(query), getLogModules()]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Audit logs"
        description={`Immutable record of security-sensitive changes. ${formatNumber(meta.totalItems)} entries.`}
      />

      <LogFilters modules={modules} showAction />

      {rows.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No audit entries match these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">Actor</th>
                <th className="px-3 py-2 font-medium">Action</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Change</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">{r.userName}</td>
                  <td className="px-3 py-2 font-medium">{r.action}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{r.module}</Badge>
                  </td>
                  <td className="max-w-md px-3 py-2">
                    {r.newValue ? (
                      <code className="block truncate text-xs text-muted-foreground">
                        {JSON.stringify(r.newValue)}
                      </code>
                    ) : (
                      <span className="text-muted-foreground">—</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <LogPager page={meta.page} totalPages={meta.totalPages} />
    </div>
  );
}
