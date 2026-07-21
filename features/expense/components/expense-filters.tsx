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
import { EXPENSE_STATUS_LABELS } from '@/features/expense/expense.types';

const ALL = 'all';
const FILTER_KEYS = [
  'status',
  'expenseCategoryId',
  'fromDate',
  'toDate',
  'minAmount',
  'maxAmount',
];

export function ExpenseFilters({ categories }: { categories: { id: string; name: string }[] }) {
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
  const categoryItems = {
    [ALL]: 'All categories',
    ...Object.fromEntries(categories.map((c) => [c.id, c.name])),
  };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        value={searchParams.get('status') ?? ALL}
        onValueChange={(v) => setParam('status', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(EXPENSE_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={categoryItems}
        value={searchParams.get('expenseCategoryId') ?? ALL}
        onValueChange={(v) => setParam('expenseCategoryId', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[180px]">
          <SelectValue placeholder="Category" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All categories</SelectItem>
          {categories.map((c) => (
            <SelectItem key={c.id} value={c.id}>
              {c.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-1">
        <Label htmlFor="exp-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="exp-from"
          type="date"
          className="h-9 w-[145px]"
          value={searchParams.get('fromDate') ?? ''}
          onChange={(e) => setParam('fromDate', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="exp-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="exp-to"
          type="date"
          className="h-9 w-[145px]"
          value={searchParams.get('toDate') ?? ''}
          onChange={(e) => setParam('toDate', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="exp-min" className="text-xs text-muted-foreground">
          Min ₹
        </Label>
        <Input
          id="exp-min"
          type="number"
          min={0}
          className="h-9 w-[110px]"
          defaultValue={searchParams.get('minAmount') ?? ''}
          onBlur={(e) => setParam('minAmount', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="exp-max" className="text-xs text-muted-foreground">
          Max ₹
        </Label>
        <Input
          id="exp-max"
          type="number"
          min={0}
          className="h-9 w-[110px]"
          defaultValue={searchParams.get('maxAmount') ?? ''}
          onBlur={(e) => setParam('maxAmount', e.target.value || null)}
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
