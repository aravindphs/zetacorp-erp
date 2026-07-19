'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  CUSTOMER_STATUS_CLASSES,
  CUSTOMER_STATUS_LABELS,
  CUSTOMER_TYPE_LABELS,
  type CustomerRow,
} from '@/features/customer/customer.types';
import { CustomerRowActions } from '@/features/customer/components/customer-row-actions';

export function CustomerTable({
  rows,
  meta,
  canUpdate,
  canDelete,
}: {
  rows: CustomerRow[];
  meta: PaginationMeta;
  canUpdate: boolean;
  canDelete: boolean;
}) {
  const columns: ColumnDef<CustomerRow>[] = [
    {
      accessorKey: 'customerCode',
      header: () => <DataTableColumnHeader columnId="customerCode" title="Code" />,
      cell: ({ row }) => (
        <Link href={`/customers/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.customerCode}
        </Link>
      ),
    },
    {
      accessorKey: 'customerName',
      header: () => <DataTableColumnHeader columnId="customerName" title="Name" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.customerName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.companyName ?? CUSTOMER_TYPE_LABELS[row.original.customerType]}
          </p>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: () => <DataTableColumnHeader columnId="phone" title="Phone" />,
      cell: ({ row }) => row.original.phone,
    },
    {
      accessorKey: 'gstNumber',
      header: 'GST',
      cell: ({ row }) => row.original.gstNumber ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'city',
      header: 'City',
      cell: ({ row }) => row.original.city ?? <span className="text-muted-foreground">—</span>,
    },
    {
      accessorKey: 'outstanding',
      header: () => <div className="text-right">Outstanding</div>,
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatCurrency(row.original.outstanding)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={CUSTOMER_STATUS_CLASSES[row.original.status]}>
          {CUSTOMER_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'createdAt',
      header: () => <DataTableColumnHeader columnId="createdAt" title="Created" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.createdAt)}</span>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <CustomerRowActions customer={row.original} canUpdate={canUpdate} canDelete={canDelete} />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by name, code, phone, GST…"
      emptyTitle="No customers found"
      emptyDescription="Try adjusting your search or filters, or add your first customer."
    />
  );
}
