'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  EXPENSE_STATUS_CLASSES,
  EXPENSE_STATUS_LABELS,
  type ExpenseRow,
} from '@/features/expense/expense.types';

export function ExpenseTable({
  rows,
  meta,
  showEmployee = true,
  emptyTitle = 'No expenses found',
  emptyDescription = 'Adjust your filters or submit a new claim.',
}: {
  rows: ExpenseRow[];
  meta: PaginationMeta;
  showEmployee?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const columns: ColumnDef<ExpenseRow>[] = [
    {
      accessorKey: 'expenseNumber',
      header: () => <DataTableColumnHeader columnId="expenseNumber" title="Expense #" />,
      cell: ({ row }) => (
        <Link
          href={`/finance/expenses/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.expenseNumber}
        </Link>
      ),
    },
    ...(showEmployee
      ? [
          {
            accessorKey: 'employeeName',
            header: 'Employee',
            cell: ({ row }) => <span className="truncate">{row.original.employeeName}</span>,
          } as ColumnDef<ExpenseRow>,
        ]
      : []),
    {
      accessorKey: 'expenseDate',
      header: () => <DataTableColumnHeader columnId="expenseDate" title="Date" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.expenseDate)}</span>
      ),
    },
    {
      accessorKey: 'categoryName',
      header: 'Category',
      cell: ({ row }) => <span>{row.original.categoryName}</span>,
    },
    {
      accessorKey: 'amount',
      header: () => (
        <div className="text-right">
          <DataTableColumnHeader columnId="amount" title="Amount" />
        </div>
      ),
      cell: ({ row }) => (
        <div className="text-right font-medium tabular-nums">
          {formatCurrency(row.original.amount)}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={EXPENSE_STATUS_CLASSES[row.original.status]}>
          {EXPENSE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'submittedDate',
      header: 'Submitted',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.submittedDate)}</span>
      ),
    },
    {
      accessorKey: 'approverName',
      header: 'Approved by',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.approverName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'reimbursedAt',
      header: 'Reimbursed',
      cell: ({ row }) => (
        <span className="text-muted-foreground">
          {row.original.reimbursedAt ? formatDate(row.original.reimbursedAt) : '—'}
        </span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by expense #, vendor, description…"
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
