import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { Pencil } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { ButtonLink } from '@/components/shared/button-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getProductDetail } from '@/features/inventory/product.repository';
import { getProductSummary, getProductTransactions } from '@/features/inventory/product.queries';
import { ProductDetailTabs } from '@/features/inventory/components/product-detail-tabs';
import { ProductAdjustButton } from '@/features/inventory/components/product-adjust-button';
import { PRODUCT_STATUS_CLASSES, PRODUCT_STATUS_LABELS } from '@/constants/inventory';
import { formatCurrency, formatDate, formatNumber } from '@/utils/format';

export const metadata: Metadata = { title: 'Product' };

export default async function ProductDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('inventory.view');
  const { id } = await params;
  const product = await getProductDetail(id);
  if (!product) notFound();

  const currentStock = product.currentStock.toNumber();
  const canViewTxns = hasPermission(user, 'inventory.transactions');

  const [summary, transactions] = await Promise.all([
    getProductSummary({
      id: product.id,
      currentStock,
      purchasePrice: product.purchasePrice.toNumber(),
      sellingPrice: product.sellingPrice.toNumber(),
    }),
    canViewTxns ? getProductTransactions(product.id) : Promise.resolve([]),
  ]);

  const cards = [
    { label: 'Current stock', value: `${formatNumber(currentStock)} ${product.unit}` },
    { label: 'Purchase value', value: formatCurrency(summary.purchaseValue) },
    { label: 'Selling value', value: formatCurrency(summary.sellingValue) },
    { label: 'Potential profit', value: formatCurrency(summary.potentialProfit) },
    { label: 'Last sold', value: summary.lastSold ? formatDate(summary.lastSold) : '—' },
    { label: 'Last purchased', value: summary.lastPurchased ? formatDate(summary.lastPurchased) : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{product.productName}</h1>
            <Badge variant="secondary" className={PRODUCT_STATUS_CLASSES[product.status]}>
              {PRODUCT_STATUS_LABELS[product.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {product.productCode} · {product.category.name}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(user, 'inventory.update') && (
            <ButtonLink href={`/inventory/${product.id}/edit`} variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </ButtonLink>
          )}
          {hasPermission(user, 'inventory.adjust') && (
            <ProductAdjustButton
              product={{
                id: product.id,
                productCode: product.productCode,
                productName: product.productName,
                currentStock,
              }}
            />
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <ProductDetailTabs
        overview={{
          category: product.category.name,
          brand: product.brand,
          model: product.model,
          hsnCode: product.hsnCode,
          sku: product.sku,
          unit: product.unit,
          description: product.description,
          purchasePrice: product.purchasePrice.toNumber(),
          sellingPrice: product.sellingPrice.toNumber(),
          mrp: product.mrp?.toNumber() ?? null,
          discountPercentage: product.discountPercentage.toNumber(),
          minimumSellingPrice: product.minimumSellingPrice?.toNumber() ?? null,
          gstPercentage: product.gstPercentage.toNumber(),
          minimumStock: product.minimumStock.toNumber(),
          maximumStock: product.maximumStock?.toNumber() ?? null,
          reorderLevel: product.reorderLevel?.toNumber() ?? null,
        }}
        transactions={transactions}
        canViewTransactions={canViewTxns}
      />
    </div>
  );
}
