import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getSystemHealth } from '@/features/admin/admin.queries';
import { formatDateTime, formatFileSize, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'System Health' };

/** Always reflect live state rather than a cached render. */
export const dynamic = 'force-dynamic';

export default async function SystemHealthPage() {
  await requirePermission('system.monitor');
  const health = await getSystemHealth();

  const healthy = health.databaseStatus === 'Connected';
  const cards = [
    { label: 'Active users', value: formatNumber(health.activeUsers) },
    { label: 'Total employees', value: formatNumber(health.totalUsers) },
    { label: 'Activity (24h)', value: formatNumber(health.activityLast24h) },
    { label: 'Settings', value: formatNumber(health.settingsCount) },
  ];

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="System health" description="Live database and runtime status." />

      <Card>
        <CardContent className="flex flex-wrap items-center justify-between gap-4 p-4">
          <div className="flex items-center gap-3">
            <span
              className={`size-3 rounded-full ${healthy ? 'bg-green-500' : 'bg-destructive'}`}
            />
            <div>
              <p className="font-medium">Database {health.databaseStatus}</p>
              <p className="text-xs text-muted-foreground">
                Round-trip {health.databaseLatencyMs} ms
              </p>
            </div>
          </div>
          <Badge variant="secondary">{health.environment}</Badge>
        </CardContent>
      </Card>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <tbody className="divide-y">
            <tr>
              <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">
                Server time
              </td>
              <td className="px-3 py-2">{formatDateTime(health.serverTime)}</td>
            </tr>
            <tr>
              <td className="bg-muted/30 px-3 py-2 font-medium text-muted-foreground">Runtime</td>
              <td className="px-3 py-2">Node {health.nodeVersion}</td>
            </tr>
            <tr>
              <td className="bg-muted/30 px-3 py-2 font-medium text-muted-foreground">
                Latest backup
              </td>
              <td className="px-3 py-2">
                {health.latestBackup
                  ? `${health.latestBackup.name} — ${health.latestBackup.status} (${formatDateTime(health.latestBackup.createdAt)})${
                      health.latestBackup.fileSize
                        ? `, ${formatFileSize(health.latestBackup.fileSize)}`
                        : ''
                    }`
                  : 'None recorded'}
              </td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}
