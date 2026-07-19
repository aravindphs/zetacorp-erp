'use client';

import { ArrowDown, ArrowUp, ChevronsUpDown } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { cn } from '@/lib/utils';
import { useDataTableParams } from '@/components/shared/data-table/use-data-table-params';

/**
 * Sortable column header. Clicking cycles asc → desc → unsorted via the URL,
 * so the Server Component re-fetches the correctly ordered page.
 */
export function DataTableColumnHeader({
  columnId,
  title,
  className,
  sortable = true,
}: {
  columnId: string;
  title: string;
  className?: string;
  sortable?: boolean;
}) {
  const { sortBy, sortOrder, toggleSort } = useDataTableParams();

  if (!sortable) return <span className={cn('font-medium', className)}>{title}</span>;

  const active = sortBy === columnId;

  return (
    <Button
      variant="ghost"
      size="sm"
      className={cn('data-[active=true]:text-foreground -ml-2 h-8', className)}
      data-active={active}
      onClick={() => toggleSort(columnId)}
    >
      <span>{title}</span>
      {active ? (
        sortOrder === 'asc' ? (
          <ArrowUp className="size-3.5" />
        ) : (
          <ArrowDown className="size-3.5" />
        )
      ) : (
        <ChevronsUpDown className="size-3.5 opacity-50" />
      )}
    </Button>
  );
}
