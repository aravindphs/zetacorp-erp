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
import { LEAVE_STATUS_LABELS } from '@/features/leave/leave.types';

const ALL = 'all';
const FILTER_KEYS = ['status', 'leaveTypeId', 'fromDate', 'toDate'];

export function LeaveFilters({ leaveTypes }: { leaveTypes: { id: string; name: string }[] }) {
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
  const typeItems = {
    [ALL]: 'All types',
    ...Object.fromEntries(leaveTypes.map((t) => [t.id, t.name])),
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
          {Object.entries(LEAVE_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={typeItems}
        value={searchParams.get('leaveTypeId') ?? ALL}
        onValueChange={(v) => setParam('leaveTypeId', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Leave type" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All types</SelectItem>
          {leaveTypes.map((t) => (
            <SelectItem key={t.id} value={t.id}>
              {t.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-1">
        <Label htmlFor="lv-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="lv-from"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('fromDate') ?? ''}
          onChange={(e) => setParam('fromDate', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lv-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="lv-to"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('toDate') ?? ''}
          onChange={(e) => setParam('toDate', e.target.value || null)}
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
