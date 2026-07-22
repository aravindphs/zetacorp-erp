import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { backupSchema } from '@/features/admin/admin.schema';
import { getBackupHistory } from '@/features/admin/admin.queries';
import { createBackup } from '@/features/admin/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/admin/backup — recent restore points (§358). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('backup.view');
  const backups = await getBackupHistory();
  return apiSuccess(backups, { message: 'Backups', requestId });
});

/** POST /api/admin/backup — record a restore point; confirmation required (§366). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('backup.create');
  const { backupName } = backupSchema.parse(await request.json());
  const backup = await createBackup(user, backupName);
  return apiSuccess(
    { id: backup.id, backupName: backup.backupName },
    { message: 'Backup recorded', status: HttpStatus.CREATED, requestId },
  );
});
