'use client';

import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/page-states';
import { formatCurrency, formatDateTime, formatNumber } from '@/utils/format';
import { STOCK_TXN_LABELS } from '@/constants/inventory';
import type { StockTransactionRow } from '@/features/inventory/product.queries';
import type { InventoryTransactionType } from '@prisma/client';

interface Overview {
  category: string;
  brand: string | null;
  model: string | null;
  hsnCode: string | null;
  sku: string | null;
  unit: string;
  description: string | null;
  purchasePrice: number;
  sellingPrice: number;
  mrp: number | null;
  discountPercentage: number;
  minimumSellingPrice: number | null;
  gstPercentage: number;
  minimumStock: number;
  maximumStock: number | null;
  reorderLevel: number | null;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children ?? '—'}</span>
    </div>
  );
}

export function ProductDetailTabs({
  overview,
  transactions,
  canViewTransactions,
}: {
  overview: Overview;
  transactions: StockTransactionRow[];
  canViewTransactions: boolean;
}) {
  return (
    <Tabs defaultValue="overview">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="pricing">Pricing</TabsTrigger>
        {canViewTransactions && <TabsTrigger value="history">Stock history</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="mt-4 rounded-lg border p-4">
        <Row label="Category">{overview.category}</Row>
        <Row label="Brand">{overview.brand}</Row>
        <Row label="Model">{overview.model}</Row>
        <Row label="HSN code">{overview.hsnCode}</Row>
        <Row label="SKU">{overview.sku}</Row>
        <Row label="Unit">{overview.unit}</Row>
        <Row label="GST">{overview.gstPercentage}%</Row>
        <Row label="Minimum stock">{formatNumber(overview.minimumStock)}</Row>
        <Row label="Reorder level">
          {overview.reorderLevel != null ? formatNumber(overview.reorderLevel) : null}
        </Row>
        <Row label="Description">{overview.description}</Row>
      </TabsContent>

      <TabsContent value="pricing" className="mt-4 rounded-lg border p-4">
        <Row label="Purchase price">{formatCurrency(overview.purchasePrice)}</Row>
        <Row label="Selling price">{formatCurrency(overview.sellingPrice)}</Row>
        <Row label="MRP">{overview.mrp != null ? formatCurrency(overview.mrp) : null}</Row>
        <Row label="Default discount">{overview.discountPercentage}%</Row>
        <Row label="Minimum selling price">
          {overview.minimumSellingPrice != null ? formatCurrency(overview.minimumSellingPrice) : null}
        </Row>
      </TabsContent>

      {canViewTransactions && (
        <TabsContent value="history" className="mt-4">
          {transactions.length === 0 ? (
            <EmptyState title="No stock movements" description="Stock transactions appear here." />
          ) : (
            <div className="overflow-x-auto rounded-lg border">
              <table className="w-full text-sm">
                <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                  <tr>
                    <th className="px-3 py-2 font-medium">Date</th>
                    <th className="px-3 py-2 font-medium">Type</th>
                    <th className="px-3 py-2 font-medium">Qty</th>
                    <th className="px-3 py-2 font-medium">Before</th>
                    <th className="px-3 py-2 font-medium">After</th>
                    <th className="px-3 py-2 font-medium">By</th>
                    <th className="px-3 py-2 font-medium">Remarks</th>
                  </tr>
                </thead>
                <tbody className="divide-y">
                  {transactions.map((t) => (
                    <tr key={t.id}>
                      <td className="px-3 py-2 text-muted-foreground">{formatDateTime(t.createdAt)}</td>
                      <td className="px-3 py-2">
                        <Badge variant="secondary">
                          {STOCK_TXN_LABELS[t.type as InventoryTransactionType] ?? t.type}
                        </Badge>
                      </td>
                      <td className={`px-3 py-2 tabular-nums ${t.quantity >= 0 ? 'text-green-600' : 'text-destructive'}`}>
                        {t.quantity >= 0 ? '+' : ''}
                        {formatNumber(t.quantity)}
                      </td>
                      <td className="px-3 py-2 tabular-nums">{formatNumber(t.stockBefore)}</td>
                      <td className="px-3 py-2 font-medium tabular-nums">{formatNumber(t.stockAfter)}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.performedBy}</td>
                      <td className="px-3 py-2 text-muted-foreground">{t.remarks ?? '—'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
