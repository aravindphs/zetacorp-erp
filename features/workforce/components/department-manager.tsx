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
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
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
  createDepartmentAction,
  deleteDepartmentAction,
  updateDepartmentAction,
} from '@/features/workforce/catalogue.actions';
import type { DepartmentRow } from '@/features/workforce/catalogue.service';
import type { EmployeeOption } from '@/features/workforce/employee.types';

const NONE = 'none';

export function DepartmentManager({
  departments,
  managers,
  canManage,
}: {
  departments: DepartmentRow[];
  managers: EmployeeOption[];
  canManage: boolean;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<DepartmentRow | 'new' | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<DepartmentRow | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [managerId, setManagerId] = useState<string>(NONE);
  const [isActive, setIsActive] = useState(true);

  // base-ui Select shows the raw value unless given an items map (value→label).
  const managerItems: Record<string, string> = {
    [NONE]: 'No manager',
    ...Object.fromEntries(managers.map((m) => [m.id, m.fullName])),
  };

  function openForm(dept: DepartmentRow | 'new') {
    setEditing(dept);
    if (dept === 'new') {
      setName('');
      setDescription('');
      setManagerId(NONE);
      setIsActive(true);
    } else {
      setName(dept.name);
      setDescription(dept.description ?? '');
      setManagerId(dept.managerId ?? NONE);
      setIsActive(dept.isActive);
    }
  }

  function save() {
    startTransition(async () => {
      const payload = {
        name,
        description,
        managerId: managerId === NONE ? undefined : managerId,
        isActive,
      };
      const result =
        editing === 'new'
          ? await createDepartmentAction(payload)
          : await updateDepartmentAction((editing as DepartmentRow).id, payload);
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
      const result = await deleteDepartmentAction(id);
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
            <Plus className="size-4" /> Add department
          </Button>
        </div>
      )}

      {departments.length === 0 ? (
        <EmptyState
          title="No departments yet"
          description="Create your first department."
          action={
            canManage ? (
              <Button size="sm" onClick={() => openForm('new')}>
                <Plus className="size-4" /> Add department
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
                <th className="px-3 py-2 font-medium">Manager</th>
                <th className="px-3 py-2 font-medium">Employees</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {departments.map((d) => (
                <tr key={d.id}>
                  <td className="px-3 py-2">
                    <p className="font-medium">{d.name}</p>
                    {d.description && (
                      <p className="text-xs text-muted-foreground">{d.description}</p>
                    )}
                  </td>
                  <td className="px-3 py-2 text-muted-foreground">{d.managerName ?? '—'}</td>
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
                              d.employeeCount > 0 ? 'Has employees — cannot delete' : 'Delete'
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
        description={
          confirmDelete?.managerName
            ? `This department is managed by ${confirmDelete.managerName}. Deleting it removes the department and clears that assignment. This cannot be undone.`
            : 'This removes the department. This cannot be undone.'
        }
        confirmLabel="Delete department"
        isPending={isPending}
        onConfirm={() => confirmDelete && remove(confirmDelete.id)}
      />

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add department' : 'Edit department'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="dept-name">Name</Label>
              <Input id="dept-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="dept-desc">Description</Label>
              <Textarea
                id="dept-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label>Manager</Label>
              <Select
                items={managerItems}
                value={managerId}
                onValueChange={(v) => setManagerId((v as string) ?? NONE)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>No manager</SelectItem>
                  {managers.map((m) => (
                    <SelectItem key={m.id} value={m.id}>
                      {m.fullName}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
