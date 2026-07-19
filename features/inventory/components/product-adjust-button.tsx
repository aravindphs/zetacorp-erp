'use client';

import { useState } from 'react';
import { SlidersHorizontal } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { AdjustStockDialog } from '@/features/inventory/components/adjust-stock-dialog';

export function ProductAdjustButton({
  product,
}: {
  product: { id: string; productCode: string; productName: string; currentStock: number };
}) {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <SlidersHorizontal className="size-4" /> Adjust stock
      </Button>
      <AdjustStockDialog open={open} onOpenChange={setOpen} product={product} />
    </>
  );
}
