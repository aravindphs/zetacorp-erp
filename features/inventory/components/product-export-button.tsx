'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

export function ProductExportButton() {
  const searchParams = useSearchParams();
  function onExport() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    params.delete('pageSize');
    window.location.href = `/api/products/export?${params.toString()}`;
  }
  return (
    <Button variant="outline" size="sm" onClick={onExport}>
      <Download className="size-4" /> Export
    </Button>
  );
}
