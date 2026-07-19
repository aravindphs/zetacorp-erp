import 'server-only';

import { prisma } from '@/lib/prisma';

export interface ProductSummary {
  currentStock: number;
  purchaseValue: number;
  sellingValue: number;
  potentialProfit: number;
  lastSold: string | null;
  lastPurchased: string | null;
}

export async function getProductSummary(product: {
  id: string;
  currentStock: number;
  purchasePrice: number;
  sellingPrice: number;
}): Promise<ProductSummary> {
  const [lastSale, lastPurchase] = await Promise.all([
    prisma.inventoryTransaction.findFirst({
      where: { productId: product.id, transactionType: 'SALE' },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
    prisma.inventoryTransaction.findFirst({
      where: { productId: product.id, transactionType: { in: ['PURCHASE', 'OPENING_STOCK'] } },
      orderBy: { createdAt: 'desc' },
      select: { createdAt: true },
    }),
  ]);

  const purchaseValue = Number((product.currentStock * product.purchasePrice).toFixed(2));
  const sellingValue = Number((product.currentStock * product.sellingPrice).toFixed(2));

  return {
    currentStock: product.currentStock,
    purchaseValue,
    sellingValue,
    potentialProfit: Number((sellingValue - purchaseValue).toFixed(2)),
    lastSold: lastSale?.createdAt.toISOString() ?? null,
    lastPurchased: lastPurchase?.createdAt.toISOString() ?? null,
  };
}

export interface StockTransactionRow {
  id: string;
  type: string;
  quantity: number;
  stockBefore: number;
  stockAfter: number;
  remarks: string | null;
  createdAt: string;
  performedBy: string;
}

export async function getProductTransactions(
  productId: string,
  limit = 50,
): Promise<StockTransactionRow[]> {
  const txns = await prisma.inventoryTransaction.findMany({
    where: { productId },
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      transactionType: true,
      quantity: true,
      stockBefore: true,
      stockAfter: true,
      remarks: true,
      createdAt: true,
      createdBy: true,
    },
  });
  const userIds = [...new Set(txns.map((t) => t.createdBy).filter((v): v is string => Boolean(v)))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  return txns.map((t) => ({
    id: t.id,
    type: t.transactionType,
    quantity: t.quantity.toNumber(),
    stockBefore: t.stockBefore.toNumber(),
    stockAfter: t.stockAfter.toNumber(),
    remarks: t.remarks,
    createdAt: t.createdAt.toISOString(),
    performedBy: t.createdBy ? (nameById.get(t.createdBy) ?? 'System') : 'System',
  }));
}
