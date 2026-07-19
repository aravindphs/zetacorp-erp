'use client';

import { useSearchParams } from 'next/navigation';
import { Download } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Downloads the customer CSV honouring the current filters (spec §126). */
export function CustomerExportButton() {
  const searchParams = useSearchParams();

  function onExport() {
    const params = new URLSearchParams(searchParams.toString());
    params.delete('page');
    params.delete('pageSize');
    window.location.href = `/api/customers/export?${params.toString()}`;
  }

  return (
    <Button variant="outline" size="sm" onClick={onExport}>
      <Download className="size-4" /> Export
    </Button>
  );
}
