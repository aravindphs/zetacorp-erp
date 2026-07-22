'use client';

/**
 * Reusable, server-driven data table (spec §11, §379). Presentation only —
 * pagination, sorting, and search live in the URL (see useDataTableParams) and
 * the page's Server Component fetches the matching slice. TanStack Table is set
 * to manual mode so it never re-paginates/sorts on the client.
 */
import { Fragment, useEffect, useState } from 'react';
import {
  flexRender,
  getCoreRowModel,
  useReactTable,
  type Column,
  type ColumnDef,
} from '@tanstack/react-table';
import { Search, X } from 'lucide-react';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import type { PaginationMeta } from '@/types/api';
import { EmptyState, LoadingState } from '@/components/shared/page-states';
import { useDataTableParams } from '@/components/shared/data-table/use-data-table-params';

interface DataTableProps<TData, TValue> {
  columns: ColumnDef<TData, TValue>[];
  data: TData[];
  meta?: PaginationMeta;
  isLoading?: boolean;
  searchable?: boolean;
  searchPlaceholder?: string;
  emptyTitle?: string;
  emptyDescription?: string;
  emptyAction?: React.ReactNode;
}

export function DataTable<TData, TValue>({
  columns,
  data,
  meta,
  isLoading = false,
  searchable = true,
  searchPlaceholder = 'Search…',
  emptyTitle,
  emptyDescription,
  emptyAction,
}: DataTableProps<TData, TValue>) {
  const table = useReactTable({
    data,
    columns,
    getCoreRowModel: getCoreRowModel(),
    manualPagination: true,
    manualSorting: true,
    manualFiltering: true,
    pageCount: meta?.totalPages ?? -1,
  });

  return (
    <div className="space-y-4">
      {searchable && <TableSearch placeholder={searchPlaceholder} />}

      {isLoading ? (
        <LoadingState rows={Math.min(meta?.pageSize ?? 6, 8)} />
      ) : data.length === 0 ? (
        <EmptyState title={emptyTitle} description={emptyDescription} action={emptyAction} />
      ) : (
        <>
          {/*
            Below `md:` a wide record table would force horizontal scrolling, so
            each row is restacked as a card: the first column is the heading
            (usually the link to the record) and the rest become label/value
            pairs. Labels come from the column's string header where there is
            one, otherwise from a humanised column id.
          */}
          <div className="space-y-3 md:hidden">
            {table.getRowModel().rows.map((row) => {
              const [primary, ...rest] = row.getVisibleCells();
              return (
                <div key={row.id} className="rounded-lg border p-3">
                  {primary && (
                    <div className="mb-2 font-medium">
                      {flexRender(primary.column.columnDef.cell, primary.getContext())}
                    </div>
                  )}
                  <dl className="grid grid-cols-[auto_1fr] gap-x-4 gap-y-1.5 text-sm">
                    {rest.map((cell) => (
                      <Fragment key={cell.id}>
                        <dt className="text-muted-foreground">{columnLabel(cell.column)}</dt>
                        <dd className="text-right">
                          {flexRender(cell.column.columnDef.cell, cell.getContext())}
                        </dd>
                      </Fragment>
                    ))}
                  </dl>
                </div>
              );
            })}
          </div>

          <div className="hidden overflow-x-auto rounded-lg border md:block">
            <Table>
              <TableHeader>
                {table.getHeaderGroups().map((headerGroup) => (
                  <TableRow key={headerGroup.id}>
                    {headerGroup.headers.map((header) => (
                      <TableHead key={header.id}>
                        {header.isPlaceholder
                          ? null
                          : flexRender(header.column.columnDef.header, header.getContext())}
                      </TableHead>
                    ))}
                  </TableRow>
                ))}
              </TableHeader>
              <TableBody>
                {table.getRowModel().rows.map((row) => (
                  <TableRow key={row.id}>
                    {row.getVisibleCells().map((cell) => (
                      <TableCell key={cell.id}>
                        {flexRender(cell.column.columnDef.cell, cell.getContext())}
                      </TableCell>
                    ))}
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </div>
        </>
      )}

      {meta && data.length > 0 && <DataTablePagination meta={meta} />}
    </div>
  );
}

/**
 * Label for a field in the mobile card view. Prefers an explicit string header,
 * then a `meta.mobileLabel` override, and finally a humanised column id — many
 * headers are JSX (sortable header components) and carry no usable text.
 */
function columnLabel<TData>(column: Column<TData, unknown>): string {
  const meta = column.columnDef.meta as { mobileLabel?: string } | undefined;
  if (meta?.mobileLabel) return meta.mobileLabel;

  const header = column.columnDef.header;
  if (typeof header === 'string') return header;

  return column.id
    .replace(/([A-Z])/g, ' $1')
    .replace(/^./, (c) => c.toUpperCase())
    .trim();
}

function TableSearch({ placeholder }: { placeholder: string }) {
  const { search, setSearch } = useDataTableParams();
  const [value, setValue] = useState(search);

  // Keep local input in sync when the URL changes externally (e.g. back button).
  useEffect(() => setValue(search), [search]);

  // Debounce writes to the URL so we do not refetch on every keystroke.
  useEffect(() => {
    if (value === search) return;
    const id = setTimeout(() => setSearch(value), 350);
    return () => clearTimeout(id);
  }, [value, search, setSearch]);

  return (
    <div className="relative max-w-sm">
      <Search className="text-muted-foreground absolute top-1/2 left-3 size-4 -translate-y-1/2" />
      <Input
        value={value}
        onChange={(e) => setValue(e.target.value)}
        placeholder={placeholder}
        className="pr-9 pl-9"
        aria-label="Search"
      />
      {value && (
        <button
          type="button"
          onClick={() => setValue('')}
          className="text-muted-foreground hover:text-foreground absolute top-1/2 right-3 -translate-y-1/2"
          aria-label="Clear search"
        >
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}

function DataTablePagination({ meta }: { meta: PaginationMeta }) {
  const { setPage } = useDataTableParams();
  const from = (meta.page - 1) * meta.pageSize + 1;
  const to = Math.min(meta.page * meta.pageSize, meta.totalItems);

  return (
    <div className="flex flex-col items-center justify-between gap-3 sm:flex-row">
      <p className="text-muted-foreground text-sm">
        Showing <span className="text-foreground font-medium">{from}</span>–
        <span className="text-foreground font-medium">{to}</span> of{' '}
        <span className="text-foreground font-medium">{meta.totalItems}</span>
      </p>
      <div className="flex items-center gap-2">
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasPreviousPage}
          onClick={() => setPage(meta.page - 1)}
        >
          Previous
        </Button>
        <span className="text-muted-foreground text-sm">
          Page {meta.page} of {meta.totalPages}
        </span>
        <Button
          variant="outline"
          size="sm"
          disabled={!meta.hasNextPage}
          onClick={() => setPage(meta.page + 1)}
        >
          Next
        </Button>
      </div>
    </div>
  );
}
