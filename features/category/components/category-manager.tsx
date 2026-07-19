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
import {
  createCategoryAction,
  deleteCategoryAction,
  updateCategoryAction,
} from '@/features/category/category.actions';
import type { CategoryRow } from '@/features/category/category.service';

interface Perms {
  canCreate: boolean;
  canUpdate: boolean;
  canDelete: boolean;
}

export function CategoryManager({
  categories,
  perms,
}: {
  categories: CategoryRow[];
  perms: Perms;
}) {
  const router = useRouter();
  const [editing, setEditing] = useState<CategoryRow | 'new' | null>(null);
  const [isPending, startTransition] = useTransition();

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [displayOrder, setDisplayOrder] = useState('0');
  const [isActive, setIsActive] = useState(true);

  function openForm(cat: CategoryRow | 'new') {
    setEditing(cat);
    if (cat === 'new') {
      setName('');
      setDescription('');
      setDisplayOrder(String(categories.length));
      setIsActive(true);
    } else {
      setName(cat.name);
      setDescription(cat.description ?? '');
      setDisplayOrder(String(cat.displayOrder));
      setIsActive(cat.isActive);
    }
  }

  function save() {
    startTransition(async () => {
      const payload = { name, description, displayOrder: Number(displayOrder), isActive };
      const result =
        editing === 'new'
          ? await createCategoryAction(payload)
          : await updateCategoryAction((editing as CategoryRow).id, payload);
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
      const result = await deleteCategoryAction(id);
      if (result.success) {
        toast.success(result.message);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <div className="space-y-4">
      {perms.canCreate && (
        <div className="flex justify-end">
          <Button size="sm" onClick={() => openForm('new')}>
            <Plus className="size-4" /> Add category
          </Button>
        </div>
      )}

      {categories.length === 0 ? (
        <EmptyState
          title="No categories yet"
          description="Create your first product category."
          action={
            perms.canCreate ? (
              <Button size="sm" onClick={() => openForm('new')}>
                <Plus className="size-4" /> Add category
              </Button>
            ) : undefined
          }
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
              <tr>
                <th className="px-3 py-2 font-medium">Order</th>
                <th className="px-3 py-2 font-medium">Name</th>
                <th className="px-3 py-2 font-medium">Products</th>
                <th className="px-3 py-2 font-medium">Status</th>
                <th className="px-3 py-2" />
              </tr>
            </thead>
            <tbody className="divide-y">
              {categories.map((c) => (
                <tr key={c.id}>
                  <td className="px-3 py-2 text-muted-foreground tabular-nums">{c.displayOrder}</td>
                  <td className="px-3 py-2">
                    <p className="font-medium">{c.name}</p>
                    {c.description && <p className="text-xs text-muted-foreground">{c.description}</p>}
                  </td>
                  <td className="px-3 py-2 tabular-nums">{c.productCount}</td>
                  <td className="px-3 py-2">
                    <Badge
                      variant="secondary"
                      className={c.isActive ? 'bg-green-500/10 text-green-600' : 'bg-muted text-muted-foreground'}
                    >
                      {c.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </td>
                  <td className="px-3 py-2 text-right">
                    <div className="flex justify-end gap-1">
                      {perms.canUpdate && (
                        <Button variant="ghost" size="icon" className="size-8" onClick={() => openForm(c)}>
                          <Pencil className="size-4" />
                        </Button>
                      )}
                      {perms.canDelete && (
                        <Button
                          variant="ghost"
                          size="icon"
                          className="size-8 text-destructive"
                          disabled={isPending}
                          onClick={() => remove(c.id)}
                          title={c.productCount > 0 ? 'Has products — cannot delete' : 'Delete'}
                        >
                          <Trash2 className="size-4" />
                        </Button>
                      )}
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Dialog open={editing !== null} onOpenChange={(o) => !o && setEditing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{editing === 'new' ? 'Add category' : 'Edit category'}</DialogTitle>
          </DialogHeader>
          <div className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="cat-name">Name</Label>
              <Input id="cat-name" value={name} onChange={(e) => setName(e.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="cat-desc">Description</Label>
              <Textarea id="cat-desc" rows={2} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
            <div className="flex items-center gap-6">
              <div className="space-y-2">
                <Label htmlFor="cat-order">Display order</Label>
                <Input
                  id="cat-order"
                  type="number"
                  className="w-24"
                  value={displayOrder}
                  onChange={(e) => setDisplayOrder(e.target.value)}
                />
              </div>
              <label className="flex items-center gap-2 text-sm">
                <Switch checked={isActive} onCheckedChange={setIsActive} /> Active
              </label>
            </div>
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
