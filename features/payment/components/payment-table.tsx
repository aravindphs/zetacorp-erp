'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
  type PaymentRow,
} from '@/features/payment/payment.types';

export function PaymentTable({ rows, meta }: { rows: PaymentRow[]; meta: PaginationMeta }) {
  const columns: ColumnDef<PaymentRow>[] = [
    {
      accessorKey: 'paymentNumber',
      header: () => <DataTableColumnHeader columnId="paymentNumber" title="Payment #" />,
      cell: ({ row }) => (
        <Link href={`/payments/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.paymentNumber}
        </Link>
      ),
    },
    {
      accessorKey: 'customerName',
      header: 'Customer',
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.customerId}`} className="truncate hover:underline">
          {row.original.customerName}
        </Link>
      ),
    },
    {
      accessorKey: 'invoiceNumber',
      header: 'Invoice',
      cell: ({ row }) => (
        <Link href={`/invoices/${row.original.invoiceId}`} className="text-primary hover:underline">
          {row.original.invoiceNumber}
        </Link>
      ),
    },
    {
      accessorKey: 'paymentDate',
      header: () => <DataTableColumnHeader columnId="paymentDate" title="Date" />,
      cell: ({ row }) => <span className="text-muted-foreground">{formatDate(row.original.paymentDate)}</span>,
    },
    {
      accessorKey: 'paymentMethod',
      header: 'Method',
      cell: ({ row }) => <span>{PAYMENT_METHOD_LABELS[row.original.paymentMethod]}</span>,
    },
    {
      accessorKey: 'referenceNumber',
      header: 'Reference',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.referenceNumber ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'amount',
      header: () => <div className="text-right"><DataTableColumnHeader columnId="amount" title="Amount" /></div>,
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums text-green-600">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={PAYMENT_STATUS_CLASSES[row.original.status]}>
          {PAYMENT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'receivedBy',
      header: 'Received by',
      cell: ({ row }) => <span className="text-muted-foreground">{row.original.receivedBy}</span>,
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by payment #, invoice, customer, reference…"
      emptyTitle="No payments found"
      emptyDescription="No payments have been recorded yet, or none match your filters."
    />
  );
}
