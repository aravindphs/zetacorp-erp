'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  LEAVE_STATUS_CLASSES,
  LEAVE_STATUS_LABELS,
  type LeaveRow,
} from '@/features/leave/leave.types';

export function LeaveTable({
  rows,
  meta,
  showEmployee = true,
  emptyTitle = 'No leave requests found',
  emptyDescription = 'Adjust your filters or apply for leave.',
}: {
  rows: LeaveRow[];
  meta: PaginationMeta;
  showEmployee?: boolean;
  emptyTitle?: string;
  emptyDescription?: string;
}) {
  const columns: ColumnDef<LeaveRow>[] = [
    {
      accessorKey: 'leaveNumber',
      header: () => <DataTableColumnHeader columnId="leaveNumber" title="Request #" />,
      cell: ({ row }) => (
        <Link
          href={`/workforce/leave/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.leaveNumber}
        </Link>
      ),
    },
    ...(showEmployee
      ? [
          {
            accessorKey: 'employeeName',
            header: 'Employee',
            cell: ({ row }) => <span className="truncate">{row.original.employeeName}</span>,
          } as ColumnDef<LeaveRow>,
        ]
      : []),
    {
      accessorKey: 'leaveTypeName',
      header: 'Type',
      cell: ({ row }) => <span>{row.original.leaveTypeName}</span>,
    },
    {
      accessorKey: 'fromDate',
      header: () => <DataTableColumnHeader columnId="fromDate" title="From" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.fromDate)}</span>
      ),
    },
    {
      accessorKey: 'toDate',
      header: 'To',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.toDate)}</span>
      ),
    },
    {
      accessorKey: 'totalDays',
      header: () => <div className="text-right">Days</div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">
          {row.original.totalDays}
          {row.original.isHalfDay && (
            <span className="ml-1 text-xs text-muted-foreground">(half)</span>
          )}
        </div>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={LEAVE_STATUS_CLASSES[row.original.status]}>
          {LEAVE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      accessorKey: 'appliedDate',
      header: 'Applied',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.appliedDate)}</span>
      ),
    },
    {
      accessorKey: 'approverName',
      header: 'Approved by',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.approverName ?? '—'}</span>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by request #, employee, reason…"
      emptyTitle={emptyTitle}
      emptyDescription={emptyDescription}
    />
  );
}
