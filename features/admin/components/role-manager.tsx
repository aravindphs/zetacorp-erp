'use client';

/**
 * Roles & permissions (spec §353, §354). Permissions are grouped by module
 * with search and bulk select, because the catalogue is ~100 keys.
 */
import { useMemo, useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { Loader2, Pencil, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ConfirmDialog } from '@/components/shared/confirm-dialog';
import {
  createRoleAction,
  deleteRoleAction,
  setRolePermissionsAction,
  updateRoleAction,
} from '@/features/admin/admin.actions';
import type { PermissionGroup, RoleRow } from '@/features/admin/admin.queries';

export function RoleManager({
  roles,
  catalogue,
  grantedByRole,
  canManage,
}: {
  roles: RoleRow[];
  catalogue: PermissionGroup[];
  grantedByRole: Record<string, string[]>;
  canManage: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [editing, setEditing] = useState<RoleRow | 'new' | null>(null);
  const [permissionsFor, setPermissionsFor] = useState<RoleRow | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<RoleRow | null>(null);

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [level, setLevel] = useState(10);

  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [search, setSearch] = useState('');

  const totalPermissions = useMemo(
    () => catalogue.reduce((sum, g) => sum + g.permissions.length, 0),
    [catalogue],
  );

  const visibleGroups = useMemo(() => {
    const term = search.trim().toLowerCase();
    if (!term) return catalogue;
    return catalogue
      .map((g) => ({
        module: g.module,
        permissions: g.permissions.filter(
          (p) =>
            p.key.toLowerCase().includes(term) ||
            (p.description ?? '').toLowerCase().includes(term),
        ),
      }))
      .filter((g) => g.permissions.length > 0);
  }, [catalogue, search]);

  function openForm(role: RoleRow | 'new') {
    setEditing(role);
    if (role === 'new') {
      setName('');
      setDescription('');
      setLevel(10);
    } else {
      setName(role.name);
      setDescription(role.description ?? '');
      setLevel(role.level);
    }
  }

  function openPermissions(role: RoleRow) {
    setPermissionsFor(role);
    setSelected(new Set(grantedByRole[role.id] ?? []));
    setSearch('');
  }

  function toggle(id: string) {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }

  function toggleModule(group: PermissionGroup, checked: boolean) {
    setSelected((prev) => {
      const next = new Set(prev);
      for (const p of group.permissions) {
        if (checked) next.add(p.id);
        else next.delete(p.id);
      }
      return next;
    });
  }

  function run(fn: () => Promise<{ success: boolean; message: string }>, onOk: () => void) {
    startTransition(async () => {
      const result = await fn();
      if (result.success) {
        toast.success(result.message);
        onOk();
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
            <Plus className="size-4" /> Add role
          </Button>
        </div>
      )}

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">Role</th>
              <th className="px-3 py-2 font-medium">Level</th>
              <th className="px-3 py-2 font-medium">Permissions</th>
              <th className="px-3 py-2 font-medium">Employees</th>
              <th className="px-3 py-2" />
            </tr>
          </thead>
          <tbody className="divide-y">
            {roles.map((r) => (
              <tr key={r.id}>
                <td className="px-3 py-2">
                  <div className="flex items-center gap-2">
                    <span className="font-medium">{r.name}</span>
                    {r.isSystemRole && (
                      <Badge variant="secondary" className="text-[10px]">
                        System
                      </Badge>
                    )}
                  </div>
                  {r.description && (
                    <p className="text-xs text-muted-foreground">{r.description}</p>
                  )}
                </td>
                <td className="px-3 py-2 tabular-nums text-muted-foreground">{r.level}</td>
                <td className="px-3 py-2 tabular-nums">
                  {r.permissionCount} / {totalPermissions}
                </td>
                <td className="px-3 py-2 tabular-nums">{r.userCount}</td>
                <td className="px-3 py-2 text-right">
                  <div className="flex justify-end gap-1">
                    {canManage && (
                      <>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Permissions"
                          onClick={() => openPermissions(r)}
                        >
                          <ShieldCheck className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8"
                          title="Edit"
                          onClick={() => openForm(r)}
                        >
                          <Pencil className="size-4" />
                        </Button>
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          disabled={isPending || r.isSystemRole || r.userCount > 0}
                          title={
                            r.isSystemRole
                              ? 'System roles cannot be deleted'
                              : r.userCount > 0
                                ? 'Role is assigned to employees'
                                : 'Delete'
                          }
                          onClick={() => setConfirmDelete(r)}
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

      <ConfirmDialog
        open={confirmDelete !== null}
        onOpenChange={(o) => !o && setConfirmDelete(null)}
        title={`Delete "${confirmDelete?.name ?? ''}"?`}
        description="This removes the role. Employees must be reassigned first. This cannot be undone."
        confirmLabel="Delete role"
        isPending={isPending}
        onConfirm={() =>
          confirmDelete &&
          run(() => deleteRoleAction(confirmDelete.id), () => setConfirmDelete(null))
        }
      />

      {/* Create / edit role */}
      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add role' : 'Edit role'}</DialogTitle>
            <DialogDescription>
              Level sets approval authority — an approver must outrank the requester.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="role-name">Name</Label>
              <Input
                id="role-name"
                value={name}
                disabled={editing !== 'new' && (editing as RoleRow)?.isSystemRole}
                onChange={(e) => setName(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-desc">Description</Label>
              <Textarea
                id="role-desc"
                rows={2}
                value={description}
                onChange={(e) => setDescription(e.target.value)}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="role-level">Authority level (0–100)</Label>
              <Input
                id="role-level"
                type="number"
                min={0}
                max={100}
                value={level}
                onChange={(e) => setLevel(Number(e.target.value))}
              />
              <p className="text-xs text-muted-foreground">
                Admin is 100, Manager 50, Staff 10.
              </p>
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setEditing(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending || name.trim().length === 0}
              onClick={() =>
                run(
                  () =>
                    editing === 'new'
                      ? createRoleAction({ name, description, level })
                      : updateRoleAction((editing as RoleRow).id, { name, description, level }),
                  () => setEditing(null),
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Bulk permission assignment (§354) */}
      <Dialog open={permissionsFor !== null} onOpenChange={(o) => !o && setPermissionsFor(null)}>
        <DialogContent className="max-h-[85vh] max-w-3xl overflow-hidden">
          <DialogHeader>
            <DialogTitle>Permissions — {permissionsFor?.name}</DialogTitle>
            <DialogDescription>
              {selected.size} of {totalPermissions} granted. Changes apply immediately.
            </DialogDescription>
          </DialogHeader>

          <Input
            placeholder="Search permissions…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />

          <div className="max-h-[45vh] space-y-4 overflow-y-auto pr-1">
            {visibleGroups.map((group) => {
              const allSelected = group.permissions.every((p) => selected.has(p.id));
              return (
                <div key={group.module}>
                  <label className="mb-1 flex items-center gap-2 text-sm font-medium capitalize">
                    <input
                      type="checkbox"
                      checked={allSelected}
                      onChange={(e) => toggleModule(group, e.target.checked)}
                    />
                    {group.module}
                    <span className="text-xs font-normal text-muted-foreground">
                      ({group.permissions.filter((p) => selected.has(p.id)).length}/
                      {group.permissions.length})
                    </span>
                  </label>
                  <div className="grid gap-1 pl-6 sm:grid-cols-2">
                    {group.permissions.map((p) => (
                      <label key={p.id} className="flex items-start gap-2 text-sm">
                        <input
                          type="checkbox"
                          className="mt-1"
                          checked={selected.has(p.id)}
                          onChange={() => toggle(p.id)}
                        />
                        <span>
                          <span className="font-mono text-xs">{p.key}</span>
                          {p.description && (
                            <span className="block text-xs text-muted-foreground">
                              {p.description}
                            </span>
                          )}
                        </span>
                      </label>
                    ))}
                  </div>
                </div>
              );
            })}
            {visibleGroups.length === 0 && (
              <p className="py-6 text-center text-sm text-muted-foreground">
                No permissions match that search.
              </p>
            )}
          </div>

          <DialogFooter>
            <Button variant="outline" onClick={() => setPermissionsFor(null)} disabled={isPending}>
              Cancel
            </Button>
            <Button
              disabled={isPending}
              onClick={() =>
                permissionsFor &&
                run(
                  () =>
                    setRolePermissionsAction(permissionsFor.id, {
                      permissionIds: [...selected],
                    }),
                  () => setPermissionsFor(null),
                )
              }
            >
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Save permissions
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}
