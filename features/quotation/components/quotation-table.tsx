'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  QUOTATION_STATUS_CLASSES,
  QUOTATION_STATUS_LABELS,
  type QuotationRow,
} from '@/features/quotation/quotation.types';

export function QuotationTable({ rows, meta }: { rows: QuotationRow[]; meta: PaginationMeta }) {
  const columns: ColumnDef<QuotationRow>[] = [
    {
      accessorKey: 'quotationNumber',
      header: () => <DataTableColumnHeader columnId="quotationNumber" title="Quotation #" />,
      cell: ({ row }) => (
        <Link href={`/quotations/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.quotationNumber}
        </Link>
      ),
    },
    { accessorKey: 'customerName', header: 'Customer', cell: ({ row }) => <span className="truncate">{row.original.customerName}</span> },
    {
      accessorKey: 'quotationDate',
      header: () => <DataTableColumnHeader columnId="quotationDate" title="Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.quotationDate)}</span>,
    },
    {
      accessorKey: 'validUntil',
      header: 'Valid until',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.validUntil ? formatDate(row.original.validUntil) : '—'}</span>,
    },
    {
      accessorKey: 'grandTotal',
      header: () => <div className="text-right"><DataTableColumnHeader columnId="grandTotal" title="Total" /></div>,
      cell: ({ row }) => <div className="text-right font-medium tabular-nums">{formatCurrency(row.original.grandTotal)}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={QUOTATION_STATUS_CLASSES[row.original.status]}>
          {QUOTATION_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by quotation #, customer, reference…"
      emptyTitle="No quotations found"
      emptyDescription="Create your first quotation or adjust filters."
    />
  );
}
