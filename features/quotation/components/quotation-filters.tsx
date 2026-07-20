'use client';

import { useCallback } from 'react';
import { usePathname, useRouter, useSearchParams } from 'next/navigation';
import { X } from 'lucide-react';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { QUOTATION_STATUS_LABELS } from '@/features/quotation/quotation.types';

const ALL = 'all';

export function QuotationFilters() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const setParam = useCallback(
    (key: string, value: string | null) => {
      const next = new URLSearchParams(searchParams.toString());
      if (!value || value === ALL) next.delete(key);
      else next.set(key, value);
      next.set('page', '1');
      router.push(`${pathname}?${next.toString()}`, { scroll: false });
    },
    [router, pathname, searchParams],
  );

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select
        items={{ [ALL]: 'All statuses', ...QUOTATION_STATUS_LABELS }}
        value={searchParams.get('status') ?? ALL}
        onValueChange={(v) => setParam('status', v)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(QUOTATION_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {searchParams.get('status') && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => setParam('status', null)}
        >
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}
