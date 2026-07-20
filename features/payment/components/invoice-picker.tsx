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
import { formatCurrency, formatDate } from '@/utils/format';
import type { ApiResponse } from '@/types/api';
import type { OutstandingInvoice } from '@/features/payment/payment.types';

/** Searches posted invoices with a balance due (spec §225). */
export function InvoicePicker({
  open,
  onOpenChange,
  onSelect,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSelect: (invoice: OutstandingInvoice) => void;
}) {
  const [query, setQuery] = useState('');
  const [items, setItems] = useState<OutstandingInvoice[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    const id = setTimeout(() => {
      fetch(`/api/payments/outstanding?q=${encodeURIComponent(query)}`)
        .then((r) => r.json() as Promise<ApiResponse<OutstandingInvoice[]>>)
        .then((json) => setItems(json.success ? json.data : []))
        .catch(() => setItems([]))
        .finally(() => setLoading(false));
    }, 250);
    return () => clearTimeout(id);
  }, [query, open]);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="overflow-hidden p-0" showCloseButton={false}>
        <DialogTitle className="sr-only">Select invoice</DialogTitle>
        <DialogDescription className="sr-only">
          Search a posted invoice with an outstanding balance.
        </DialogDescription>
        <Command shouldFilter={false}>
          <CommandInput
            value={query}
            onValueChange={setQuery}
            placeholder="Search by invoice #, customer, phone…"
          />
          <CommandList>
            {loading && (
              <div className="flex items-center justify-center gap-2 py-6 text-sm text-muted-foreground">
                <Loader2 className="size-4 animate-spin" /> Searching…
              </div>
            )}
            {!loading && items.length === 0 && (
              <CommandEmpty>All invoices are fully paid.</CommandEmpty>
            )}
            <CommandGroup>
              {items.map((inv) => (
                <CommandItem
                  key={inv.id}
                  value={inv.id}
                  onSelect={() => {
                    onSelect(inv);
                    onOpenChange(false);
                    setQuery('');
                  }}
                >
                  <div className="flex w-full items-center justify-between gap-2">
                    <span>
                      <span className="font-medium">{inv.invoiceNumber}</span>
                      <span className="ml-2 text-xs text-muted-foreground">
                        {inv.customerName} · {formatDate(inv.invoiceDate)}
                      </span>
                    </span>
                    <span className="text-right text-sm tabular-nums">
                      <span className="text-muted-foreground">due </span>
                      <span className="font-medium">{formatCurrency(inv.balanceDue)}</span>
                    </span>
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
