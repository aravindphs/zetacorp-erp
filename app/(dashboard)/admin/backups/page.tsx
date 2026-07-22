import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getBackupHistory } from '@/features/admin/admin.queries';
import { BackupPanel } from '@/features/admin/components/backup-panel';

export const metadata: Metadata = { title: 'Backups' };

export default async function BackupsPage() {
  const user = await requirePermission('backup.view');
  const backups = await getBackupHistory();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Backup & restore"
        description="Restore points and their audit trail."
      />
      <BackupPanel backups={backups} canCreate={hasPermission(user, 'backup.create')} />
    </div>
  );
}
