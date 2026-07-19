'use client';

import Link from 'next/link';
import type { ColumnDef } from '@tanstack/react-table';
import { AlertTriangle } from 'lucide-react';
import { Badge } from '@/components/ui/badge';
import { DataTable } from '@/components/shared/data-table/data-table';
import { DataTableColumnHeader } from '@/components/shared/data-table/column-header';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { PaginationMeta } from '@/types/api';
import { PRODUCT_STATUS_CLASSES, PRODUCT_STATUS_LABELS } from '@/constants/inventory';
import type { ProductRow } from '@/features/inventory/product.types';
import { ProductRowActions } from '@/features/inventory/components/product-row-actions';

export function ProductTable({
  rows,
  meta,
  canUpdate,
  canAdjust,
  canDelete,
}: {
  rows: ProductRow[];
  meta: PaginationMeta;
  canUpdate: boolean;
  canAdjust: boolean;
  canDelete: boolean;
}) {
  const columns: ColumnDef<ProductRow>[] = [
    {
      accessorKey: 'productCode',
      header: () => <DataTableColumnHeader columnId="productCode" title="Code" />,
      cell: ({ row }) => (
        <Link href={`/inventory/${row.original.id}`} className="font-medium text-primary hover:underline">
          {row.original.productCode}
        </Link>
      ),
    },
    {
      accessorKey: 'productName',
      header: () => <DataTableColumnHeader columnId="productName" title="Product" />,
      cell: ({ row }) => (
        <div className="min-w-0">
          <p className="truncate font-medium">{row.original.productName}</p>
          <p className="truncate text-xs text-muted-foreground">
            {row.original.brand ?? row.original.category}
          </p>
        </div>
      ),
    },
    { accessorKey: 'category', header: 'Category', cell: ({ row }) => row.original.category },
    {
      accessorKey: 'currentStock',
      header: () => <DataTableColumnHeader columnId="currentStock" title="Stock" />,
      cell: ({ row }) => (
        <span className="flex items-center gap-1.5 tabular-nums">
          {formatNumber(row.original.currentStock)} {row.original.unit}
          {row.original.lowStock && <AlertTriangle className="size-3.5 text-amber-600" />}
        </span>
      ),
    },
    {
      accessorKey: 'sellingPrice',
      header: () => <div className="text-right"><DataTableColumnHeader columnId="sellingPrice" title="Price" /></div>,
      cell: ({ row }) => (
        <div className="text-right tabular-nums">{formatCurrency(row.original.sellingPrice)}</div>
      ),
    },
    { accessorKey: 'gstPercentage', header: 'GST', cell: ({ row }) => `${row.original.gstPercentage}%` },
    {
      accessorKey: 'status',
      header: 'Status',
      cell: ({ row }) => (
        <Badge variant="secondary" className={PRODUCT_STATUS_CLASSES[row.original.status]}>
          {PRODUCT_STATUS_LABELS[row.original.status]}
        </Badge>
      ),
    },
    {
      id: 'actions',
      cell: ({ row }) => (
        <div className="text-right">
          <ProductRowActions
            product={{
              id: row.original.id,
              productCode: row.original.productCode,
              productName: row.original.productName,
              currentStock: row.original.currentStock,
            }}
            canUpdate={canUpdate}
            canAdjust={canAdjust}
            canDelete={canDelete}
          />
        </div>
      ),
    },
  ];

  return (
    <DataTable
      columns={columns}
      data={rows}
      meta={meta}
      searchPlaceholder="Search by name, code, HSN, SKU…"
      emptyTitle="No products found"
      emptyDescription="Add your first product or adjust your filters."
    />
  );
}
