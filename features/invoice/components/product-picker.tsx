'use client';

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Dialog, DialogContent, DialogDescription, DialogTitle } from '@/components/ui/dialog';
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from '@/components/ui/command';
import { formatCurrency } from '@/utils/format';
import type { ApiResponse } from '@/types/api';

export interface PickerProduct {
  id: string;
  productCode: string;
  productName: string;
  unit: string;
  sellingPrice: number;
  gstPercentage: number;
  hsnCode: string | null;
  currentStock: number;
}

export function ProductPicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (product: PickerProduct) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/products/search?q=${encodeURIComponent(query)}`)
        .then((r) => r.json() as Promise<ApiResponse<PickerProduct[]>>)
        .then((json) => setItems(json.success ? json.data : []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(id);
  }, [query, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Add product</DialogTitle>
        <DialogDescription className="sr-only">Search and select a product.</DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput value={query} onValueChange={setQuery} placeholder="Search products…" />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!loading && items.length === 0 && <CommandEmpty>No products found.</CommandEmpty>}
            <CommandGroup>
              {items.map((p) => (
                <CommandItem
                  key={p.id}
                  value={p.id}
                  onSelect={() => {
                    onSelect(p);
                    onOpenChange(false);
                    setQuery('');
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{p.productName}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {p.productCode} · stock {p.currentStock}
                      </span>
                    </span>
                    <span className="text-sm tabular-nums">{formatCurrency(p.sellingPrice)}</span>
                  </div>
                </CommandItem>
              ))}
            </CommandGroup>
          </CommandList>
        </Command>
      </DialogContent>
    </Dialog>
  );
}
