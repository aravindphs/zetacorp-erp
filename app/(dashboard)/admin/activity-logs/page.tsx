import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { activityLogQuerySchema } from '@/features/admin/admin.schema';
import { getActivityLogs, getLogModules } from '@/features/admin/admin.queries';
import { LogFilters, LogPager } from '@/features/admin/components/log-filters';
import { formatDateTime, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Activity Logs' };

export default async function ActivityLogsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('activity.view');
  const query = activityLogQuerySchema.parse(await searchParams);

  const [{ rows, meta }, modules] = await Promise.all([
    getActivityLogs(query),
    getLogModules(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Activity logs"
        description={`Everything users have done. ${formatNumber(meta.totalItems)} entries.`}
      />

      <LogFilters modules={modules} showSearch />

      {rows.length === 0 ? (
        <p className="rounded-lg border p-4 text-sm text-muted-foreground">
          No activity matches these filters.
        </p>
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">When</th>
                <th className="px-3 py-2 font-medium">User</th>
                <th className="px-3 py-2 font-medium">Module</th>
                <th className="px-3 py-2 font-medium">Activity</th>
                <th className="px-3 py-2 font-medium">IP</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {rows.map((r) => (
                <tr key={r.id}>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(r.createdAt)}
                  </td>
                  <td className="px-3 py-2">{r.userName}</td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary">{r.module}</Badge>
                  </td>
                  <td className="px-3 py-2">{r.activity}</td>
                  <td className="px-3 py-2 text-muted-foreground">{r.ipAddress ?? '—'}</td>
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
