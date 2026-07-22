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

const ALL = 'all';
const KEYS = ['module', 'action', 'fromDate', 'toDate', 'search'];

/** Shared filter bar for the activity and audit log viewers (§360, §361). */
export function LogFilters({
  modules,
  showSearch = false,
  showAction = false,
}: {
  modules: string[];
  showSearch?: boolean;
  showAction?: boolean;
}) {
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

  const hasFilters = KEYS.some((k) => searchParams.get(k));
  const moduleItems = { [ALL]: 'All modules', ...Object.fromEntries(modules.map((m) => [m, m])) };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        items={moduleItems}
        value={searchParams.get('module') ?? ALL}
        onValueChange={(v) => setParam('module', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Module" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All modules</SelectItem>
          {modules.map((m) => (
            <SelectItem key={m} value={m}>
              {m}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      {showAction && (
        <div className="space-y-1">
          <Label htmlFor="lg-action" className="text-xs text-muted-foreground">
            Action
          </Label>
          <Input
            id="lg-action"
            className="h-9 w-[160px]"
            placeholder="e.g. ROLE_UPDATE"
            defaultValue={searchParams.get('action') ?? ''}
            onBlur={(e) => setParam('action', e.target.value || null)}
          />
        </div>
      )}

      {showSearch && (
        <div className="space-y-1">
          <Label htmlFor="lg-search" className="text-xs text-muted-foreground">
            Search
          </Label>
          <Input
            id="lg-search"
            className="h-9 w-[200px]"
            placeholder="Activity contains…"
            defaultValue={searchParams.get('search') ?? ''}
            onBlur={(e) => setParam('search', e.target.value || null)}
          />
        </div>
      )}

      <div className="space-y-1">
        <Label htmlFor="lg-from" className="text-xs text-muted-foreground">
          From
        </Label>
        <Input
          id="lg-from"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('fromDate') ?? ''}
          onChange={(e) => setParam('fromDate', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="lg-to" className="text-xs text-muted-foreground">
          To
        </Label>
        <Input
          id="lg-to"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('toDate') ?? ''}
          onChange={(e) => setParam('toDate', e.target.value || null)}
        />
      </div>

      {hasFilters && (
        <Button variant="ghost" size="sm" onClick={() => router.push(pathname, { scroll: false })}>
          <X className="size-4" /> Clear
        </Button>
      )}
    </div>
  );
}

/** Server-driven pager shared by both log pages. */
export function LogPager({ page, totalPages }: { page: number; totalPages: number }) {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  function go(next: number) {
    const params = new URLSearchParams(searchParams.toString());
    params.set('page', String(next));
    router.push(`${pathname}?${params.toString()}`, { scroll: false });
  }

  if (totalPages <= 1) return null;

  return (
    <div className="flex items-center justify-between text-sm">
      <p className="text-muted-foreground">
        Page {page} of {totalPages}
      </p>
      <div className="flex gap-2">
        <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => go(page - 1)}>
          Previous
        </Button>
        <Button
          variant="outline"
          size="sm"
          disabled={page >= totalPages}
          onClick={() => go(page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
