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
import { CUSTOMER_STATUS_LABELS, CUSTOMER_TYPE_LABELS } from '@/features/customer/customer.types';

const ALL = 'all';
const FILTER_KEYS = ['status', 'customerType', 'gstRegistered', 'city'] as const;

export function CustomerFilters() {
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

  const clearAll = useCallback(() => {
    const next = new URLSearchParams(searchParams.toString());
    for (const k of FILTER_KEYS) next.delete(k);
    next.set('page', '1');
    router.push(`${pathname}?${next.toString()}`, { scroll: false });
  }, [router, pathname, searchParams]);

  const hasFilters = FILTER_KEYS.some((k) => searchParams.get(k));

  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={searchParams.get('status') ?? ALL} onValueChange={(v) => setParam('status', v)}>
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(CUSTOMER_STATUS_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('customerType') ?? ALL}
        onValueChange={(v) => setParam('customerType', v)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {Object.entries(CUSTOMER_TYPE_LABELS).map(([value, label]) => (
            <SelectItem key={value} value={value}>
              {label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('gstRegistered') ?? ALL}
        onValueChange={(v) => setParam('gstRegistered', v)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="GST" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>GST: any</SelectItem>
          <SelectItem value="yes">GST registered</SelectItem>
          <SelectItem value="no">Not registered</SelectItem>
        </SelectContent>
      </Select>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={clearAll}>
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}
