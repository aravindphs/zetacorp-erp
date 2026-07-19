'use client';

import { useState, useTransition } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { Eye, MoreHorizontal, Pencil, SlidersHorizontal, Trash2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { Button } from '@/components/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { AdjustStockDialog } from '@/features/inventory/components/adjust-stock-dialog';
import { deleteProductAction } from '@/features/inventory/product.actions';

export function ProductRowActions({
  product,
  canUpdate,
  canAdjust,
  canDelete,
}: {
  product: { id: string; productCode: string; productName: string; currentStock: number };
  canUpdate: boolean;
  canAdjust: boolean;
  canDelete: boolean;
}) {
  const router = useRouter();
  const [adjustOpen, setAdjustOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);
  const [reason, setReason] = useState('');
  const [isPending, startTransition] = useTransition();

  function onDelete() {
    startTransition(async () => {
      const result = await deleteProductAction(product.id, { reason });
      if (result.success) {
        toast.success(result.message);
        setDeleteOpen(false);
        router.refresh();
      } else {
        toast.error(result.message);
      }
    });
  }

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger
          render={
            <Button variant="ghost" size="icon" className="size-8" aria-label="Actions">
              <MoreHorizontal className="size-4" />
            </Button>
          }
        />
        <DropdownMenuContent align="end">
          <DropdownMenuItem render={<Link href={`/inventory/${product.id}`} />}>
            <Eye className="size-4" /> View
          </DropdownMenuItem>
          {canUpdate && (
            <DropdownMenuItem render={<Link href={`/inventory/${product.id}/edit`} />}>
              <Pencil className="size-4" /> Edit
            </DropdownMenuItem>
          )}
          {canAdjust && (
            <DropdownMenuItem onClick={() => setAdjustOpen(true)}>
              <SlidersHorizontal className="size-4" /> Adjust stock
            </DropdownMenuItem>
          )}
          {canDelete && (
            <>
              <DropdownMenuSeparator />
              <DropdownMenuItem variant="destructive" onClick={() => setDeleteOpen(true)}>
                <Trash2 className="size-4" /> Delete
              </DropdownMenuItem>
            </>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <AdjustStockDialog open={adjustOpen} onOpenChange={setAdjustOpen} product={product} />

      <Dialog open={deleteOpen} onOpenChange={setDeleteOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete product</DialogTitle>
            <DialogDescription>
              Soft-deletes <strong>{product.productName}</strong> ({product.productCode}). Provide a
              reason.
            </DialogDescription>
          </DialogHeader>
          <div className="space-y-2">
            <Label htmlFor="del-reason">Reason</Label>
            <Textarea id="del-reason" value={reason} onChange={(e) => setReason(e.target.value)} rows={3} />
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteOpen(false)} disabled={isPending}>
              Cancel
            </Button>
            <Button variant="destructive" onClick={onDelete} disabled={isPending || reason.trim().length === 0}>
              {isPending && <Loader2 className="size-4 animate-spin" />}
              Delete
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
