'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Switch } from '@/components/ui/switch';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { EmptyState } from '@/components/shared/page-states';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  createDesignationAction,
  deleteDesignationAction,
  updateDesignationAction,
} from '@/features/workforce/catalogue.actions';
import type { DesignationRow } from '@/features/workforce/catalogue.service';

export function DesignationManager({
  designations,
  canManage,
}: {
  designations: DesignationRow[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DesignationRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DesignationRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [isActive, setIsActive] = useState(true);

  function openForm(row: DesignationRow | 'new') {
    setEditing(row);
    if (row === 'new') {
      setName('');
      setDescription('');
      setIsActive(true);
    } else {
      setName(row.name);
      setDescription(row.description ?? '');
      setIsActive(row.isActive);
    }
  }

  function save() {
    startTransition(async () => {
      const payload = { name, description, isActive };
      const result =
        editing === 'new'
          ? await createDesignationAction(payload)
          : await updateDesignationAction((editing as DesignationRow).id, payload);
      if (result.success) {
        toast.success(result.message);
        setEditing(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  function remove(id: string) {
    startTransition(async () => {
      const result = await deleteDesignationAction(id);
      if (result.success) {
        toast.success(result.message);
        setConfirmDelete(null);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {canManage && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm('new')}>
            <Plus className="size-4" /> Add designation
          </Button>
        </div>
      )}

      {designations.length === 0 ? (
        <EmptyState
          title="No designations yet"
          description="Create your first designation."
          action={
            canManage ? (
              <Button size="sm" onClick={() => openForm('new')}>
                <Plus className="size-4" /> Add designation
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Employees</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {designations.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{d.name}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{d.employeeCount}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={
                        d.isActive
                          ? 'bg-green-500/10 text-green-600'
                          : 'bg-muted text-muted-foreground'
                      }
                    >
                      {d.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {canManage && (
                        <>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8"
                            onClick={() => openForm(d)}
                          >
                            <Pencil className="size-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            className="size-8 text-destructive"
                            disabled={isPending || d.employeeCount > 0}
                            onClick={() => setConfirmDelete(d)}
                            title={
                              d.employeeCount > 0 ? 'Assigned to employees — cannot delete' : 'Delete'
                            }
                          >
                            <Trash2 className="size-4" />
                          </Button>
                        </>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        description="This removes the designation. This cannot be undone."
        confirmLabel="Delete designation"
        isPending={isPending}
        onConfirm={() => confirmDelete && remove(confirmDelete.id)}
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add designation' : 'Edit designation'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="desig-name">Name</Label>
              <Input id="desig-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="desig-desc">Description</Label>
              <Textarea
                id="desig-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <label className="flex items-center gap-2 text-sm">
              <Switch checked={isActive} onCheckedChange={setIsActive} /> Active
            </label>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button onClick={save} disabled={isPending || name.trim().length === 0}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
