'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  INVOICE_STATUS_CLASSES,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
  type InvoiceRow,
} from '@/features/invoice/invoice.types';

export function InvoiceTable({ rows, meta }: { rows: InvoiceRow[]; meta: PaginationMeta }) {
  const columns: ColumnDef<InvoiceRow>[] = [
    {
      accessorKey: 'invoiceNumber',
      header: () => <DataTableColumnHeader columnId="invoiceNumber" title="Invoice #" />,
      cell: ({ row }) => (
        <Link href={`/invoices/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    { accessorKey: 'customerName', header: 'Customer', cell: ({ row }) => (
      <span className="truncate">{row.original.customerName}</span>
    ) },
    {
      accessorKey: 'invoiceDate',
      header: () => <DataTableColumnHeader columnId="invoiceDate" title="Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.invoiceDate)}</span>,
    },
    {
      accessorKey: 'grandTotal',
      header: () => <div className="text-right"><DataTableColumnHeader columnId="grandTotal" title="Total" /></div>,
      cell: ({ row }) => <div className="text-right font-medium tabular-nums">{formatCurrency(row.original.grandTotal)}</div>,
    },
    {
      accessorKey: 'balanceDue',
      header: () => <div className="text-right">Balance</div>,
      cell: ({ row }) => <div className="text-right tabular-nums">{formatCurrency(row.original.balanceDue)}</div>,
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={INVOICE_STATUS_CLASSES[row.original.status]}>
          {INVOICE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'paymentStatus',
      header: 'Payment',
      cell: ({ row }) => (
        <Badge variant="secondary" className={PAYMENT_STATUS_CLASSES[row.original.paymentStatus]}>
          {PAYMENT_STATUS_LABELS[row.original.paymentStatus]}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by invoice #, customer, reference…"
      emptyTitle="No invoices found"
      emptyDescription="Create your first invoice or adjust filters."
    />
  );
}
