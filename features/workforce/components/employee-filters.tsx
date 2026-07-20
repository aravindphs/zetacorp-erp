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
import { EMPLOYEE_STATUS_LABELS } from '@/features/workforce/employee.types';

const ALL = 'all';
const FILTER_KEYS = ['status', 'departmentId', 'roleId', 'joinedFrom', 'joinedTo'];

/** Department / role / status / joining-date filters (§248). */
export function EmployeeFilters({
  departments,
  roles,
}: {
  departments: { id: string; name: string }[];
  roles: { id: string; name: string }[];
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

  const hasFilters = FILTER_KEYS.some((k) => searchParams.get(k));

  const deptItems = { [ALL]: 'All departments', ...Object.fromEntries(departments.map((d) => [d.id, d.name])) };
  const roleItems = { [ALL]: 'All roles', ...Object.fromEntries(roles.map((r) => [r.id, r.name])) };

  return (
    <div className="flex flex-wrap items-end gap-2">
      <Select
        items={deptItems}
        value={searchParams.get('departmentId') ?? ALL}
        onValueChange={(v) => setParam('departmentId', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[170px]">
          <SelectValue placeholder="Department" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All departments</SelectItem>
          {departments.map((d) => (
            <SelectItem key={d.id} value={d.id}>
              {d.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        items={roleItems}
        value={searchParams.get('roleId') ?? ALL}
        onValueChange={(v) => setParam('roleId', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Role" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All roles</SelectItem>
          {roles.map((r) => (
            <SelectItem key={r.id} value={r.id}>
              {r.name}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <Select
        value={searchParams.get('status') ?? ALL}
        onValueChange={(v) => setParam('status', v as string | null)}
      >
        <SelectTrigger className="h-9 w-[150px]">
          <SelectValue placeholder="Status" />
        </SelectTrigger>
        <SelectContent>
          <SelectItem value={ALL}>All statuses</SelectItem>
          {Object.entries(EMPLOYEE_STATUS_LABELS).map(([v, l]) => (
            <SelectItem key={v} value={v}>
              {l}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>

      <div className="space-y-1">
        <Label htmlFor="emp-from" className="text-xs text-muted-foreground">
          Joined from
        </Label>
        <Input
          id="emp-from"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('joinedFrom') ?? ''}
          onChange={(e) => setParam('joinedFrom', e.target.value || null)}
        />
      </div>
      <div className="space-y-1">
        <Label htmlFor="emp-to" className="text-xs text-muted-foreground">
          Joined to
        </Label>
        <Input
          id="emp-to"
          type="date"
          className="h-9 w-[150px]"
          value={searchParams.get('joinedTo') ?? ''}
          onChange={(e) => setParam('joinedTo', e.target.value || null)}
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
