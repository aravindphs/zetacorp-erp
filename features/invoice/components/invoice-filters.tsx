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
import { INVOICE_STATUS_LABELS, PAYMENT_STATUS_LABELS } from '@/features/invoice/invoice.types';

const ALL = 'all';

export function InvoiceFilters() {
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

  const hasFilters = searchParams.get('status') || searchParams.get('paymentStatus');

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get('status') ?? ALL} onValueChange={(v) => setParam('status', v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(INVOICE_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get('paymentStatus') ?? ALL} onValueChange={(v) => setParam('paymentStatus', v)}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Payment" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any payment</SelectItem>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            ['status', 'paymentStatus'].forEach((k) => next.delete(k));
            next.set('page', '1');
            router.push(`${pathname}?${next.toString()}`, { scroll: false });
          }}
        >
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}
