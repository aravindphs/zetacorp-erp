'use client';

/**
 * Backup history and manual restore points (spec §358). Creating one requires
 * explicit confirmation and always writes an audit entry.
 */
import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { DatabaseBackup, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/page-states';
import { formatDateTime, formatFileSize } from '@/utils/format';
import { createBackupAction } from '@/features/admin/admin.actions';

interface BackupRow {
  id: string;
  backupName: string;
  backupType: string;
  fileSize: number | null;
  status: string;
  createdAt: string;
  createdByName: string;
}

const STATUS_CLASSES: Record<string, string> = {
  SUCCESS: 'bg-green-500/10 text-green-600',
  PENDING: 'bg-amber-500/10 text-amber-600',
  IN_PROGRESS: 'bg-blue-500/10 text-blue-600',
  FAILED: 'bg-destructive/10 text-destructive',
};

export function BackupPanel({
  backups,
  canCreate,
}: {
  backups: BackupRow[];
  canCreate: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [open, setOpen] = useState(false);
  const [name, setName] = useState('');

  function create() {
    startTransition(async () => {
      const result = await createBackupAction({ backupName: name || undefined, confirm: true });
      if (result.success) {
        toast.success(result.message);
        setOpen(false);
        setName('');
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => setOpen(true)}>
            <DatabaseBackup className="size-4" /> Create restore point
          </Button>
        </div>
      )}

      {backups.length === 0 ? (
        <EmptyState
          title="No backups recorded yet"
          description="Create a restore point to mark a known-good state."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Backup</th>
                <th className="px-3 py-2 font-medium">Type</th>
                <th className="px-3 py-2 font-medium">Size</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2 font-medium">Created</th>
                <th className="px-3 py-2 font-medium">By</th>
              </tr>
            </thead>
            <tbody className="divide-y">
              {backups.map((b) => (
                <tr key={b.id}>
                  <td className="px-3 py-2 font-medium">{b.backupName}</td>
                  <td className="px-3 py-2 text-muted-foreground">{b.backupType}</td>
                  <td className="px-3 py-2 tabular-nums text-muted-foreground">
                    {b.fileSize === null ? '—' : formatFileSize(b.fileSize)}
                  </td>
                  <td className="px-3 py-2">
                    <Badge variant="secondary" className={STATUS_CLASSES[b.status] ?? ''}>
                      {b.status}
                    </Badge>
                  </td>
                  <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                    {formatDateTime(b.createdAt)}
                  </td>
                  <td className="px-3 py-2">{b.createdByName}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <p className="text-xs text-muted-foreground">
        Database backups are taken and retained by Supabase. Restore points recorded here mark a
        known-good state and are audit-logged; performing an actual restore is done from the
        Supabase dashboard by an administrator.
      </p>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Create restore point</DialogTitle>
            <DialogDescription>
              This records a named restore point and writes an audit entry.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="backup-name">Name (optional)</Label>
            <Input
              id="backup-name"
              value={name}
              placeholder="Before price revision"
              onChange={(e) => setName(e.target.value)}
            />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={create} disabled={isPending}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Confirm
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
