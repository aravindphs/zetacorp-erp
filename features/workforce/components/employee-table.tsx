'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatDate } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import {
  EMPLOYEE_STATUS_CLASSES,
  EMPLOYEE_STATUS_LABELS,
  type EmployeeRow,
} from '@/features/workforce/employee.types';

/** Initials fallback while no profile photo is uploaded (§248). */
function Avatar({ name, src }: { name: string; src: string | null }) {
  const initials = name
    .split(' ')
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase() ?? '')
    .join('');
  return src ? (
    // eslint-disable-next-line @next/next/no-img-element
    <img src={src} alt="" className="size-8 rounded-full object-cover" />
  ) : (
    <span className="flex size-8 items-center justify-center rounded-full bg-muted text-xs font-medium text-muted-foreground">
      {initials || '?'}
    </span>
  );
}

export function EmployeeTable({ rows, meta }: { rows: EmployeeRow[]; meta: PaginationMeta }) {
  const columns: ColumnDef<EmployeeRow>[] = [
    {
      accessorKey: 'employeeCode',
      header: () => <DataTableColumnHeader columnId="employeeCode" title="Code" />,
      cell: ({ row }) => (
        <Link
          href={`/workforce/employees/${row.original.id}`}
          className="font-medium text-primary hover:underline"
        >
          {row.original.employeeCode}
        </Link>
      ),
    },
    {
      accessorKey: 'fullName',
      header: () => <DataTableColumnHeader columnId="fullName" title="Employee" />,
      cell: ({ row }) => (
        <div className="flex items-center gap-2">
          <Avatar name={row.original.fullName} src={row.original.profilePhoto} />
          <div className="min-w-0">
            <p className="truncate font-medium">{row.original.fullName}</p>
            <p className="truncate text-xs text-muted-foreground">{row.original.email}</p>
          </div>
        </div>
      ),
    },
    {
      accessorKey: 'phone',
      header: 'Phone',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.phone ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'departmentName',
      header: 'Department',
      cell: ({ row }) => <span>{row.original.departmentName ?? '—'}</span>,
    },
    {
      accessorKey: 'designationName',
      header: 'Designation',
      cell: ({ row }) => (
        <span className="text-muted-foreground">{row.original.designationName ?? '—'}</span>
      ),
    },
    {
      accessorKey: 'roleName',
      header: 'Role',
      cell: ({ row }) => <Badge variant="secondary">{row.original.roleName}</Badge>,
    },
    {
      accessorKey: 'joiningDate',
      header: () => <DataTableColumnHeader columnId="joiningDate" title="Joined" />,
      cell: ({ row }) => (
        <span className="text-muted-foreground">{formatDate(row.original.joiningDate)}</span>
      ),
    },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={EMPLOYEE_STATUS_CLASSES[row.original.status]}>
          {EMPLOYEE_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by code, name, email, phone…"
      emptyTitle="No employees found"
      emptyDescription="Create your first employee or adjust filters."
    />
  );
}
