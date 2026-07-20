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
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { PAYMENT_METHOD_LABELS, PAYMENT_STATUS_LABELS } from '@/features/payment/payment.types';

const ALL = 'all';
const FILTER_KEYS = ['status', 'method', 'dateFrom', 'dateTo'];

export function PaymentFilters() {
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

  const hasFilters = FILTER_KEYS.some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select value={searchParams.get('status') ?? ALL} onValueChange={(v) => setParam('status', v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(PAYMENT_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select value={searchParams.get('method') ?? ALL} onValueChange={(v) => setParam('method', v)}>
        <SelectTrigger className="h-9 w-[160px]">
          <SelectValue placeholder="Method" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>Any method</SelectItem>
          {Object.entries(PAYMENT_METHOD_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>{l}</SelectItem>
          ))}
        </SelectContent>
      </Select>
      <div className="space-y-1">
        <Label htmlFor="pay-from" className="text-xs text-muted-foreground">From</Label>
        <Input
          id="pay-from"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('dateFrom') ?? ''}
          onChange={(e) => setParam('dateFrom', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="pay-to" className="text-xs text-muted-foreground">To</Label>
        <Input
          id="pay-to"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('dateTo') ?? ''}
          onChange={(e) => setParam('dateTo', e.target.value || null)}
        />
      </div>
      {hasFilters && (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            const next = new URLSearchParams(searchParams.toString());
            FILTER_KEYS.forEach((k) => next.delete(k));
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
