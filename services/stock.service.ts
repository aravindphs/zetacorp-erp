import 'server-only';

/**
 * Stock movement engine (spec §29, §144, §154, §203). The ONLY way stock ever
 * changes: every movement atomically updates `products.current_stock` and
 * writes an immutable `inventory_transactions` row. Never mutate stock directly.
 *
 * Must run inside the caller's transaction so the stock change and the record
 * that caused it (invoice, adjustment) commit together.
 */
import { Prisma } from '@prisma/client';
import type { InventoryTransactionType } from '@prisma/client';

export interface StockMovementInput {
  productId: string;
  type: InventoryTransactionType;
  /** Signed change: positive adds stock, negative removes it. */
  delta: number;
  referenceType?: string | null;
  referenceId?: string | null;
  remarks?: string | null;
  userId: string | null;
}

export interface StockMovementResult {
  stockBefore: number;
  stockAfter: number;
}

export async function applyStockMovement(
  tx: Prisma.TransactionClient,
  input: StockMovementInput,
): Promise<StockMovementResult> {
  // Atomic read-modify-write on the product row (row lock via UPDATE).
  const rows = await tx.$queryRaw<{ current_stock: Prisma.Decimal }[]>(
    Prisma.sql`UPDATE products
               SET current_stock = current_stock + ${input.delta}, updated_at = now()
               WHERE id = ${input.productId}::uuid
               RETURNING current_stock`,
  );
  const row = rows[0];
  if (!row) throw new Error(`Product ${input.productId} not found for stock movement.`);

  const stockAfter = Number(row.current_stock);
  const stockBefore = Number((stockAfter - input.delta).toFixed(3));

  await tx.inventoryTransaction.create({
    data: {
      productId: input.productId,
      transactionType: input.type,
      quantity: new Prisma.Decimal(input.delta),
      stockBefore: new Prisma.Decimal(stockBefore),
      stockAfter: new Prisma.Decimal(stockAfter),
      referenceType: input.referenceType ?? null,
      referenceId: input.referenceId ?? null,
      remarks: input.remarks ?? null,
      createdBy: input.userId,
    },
  });

  // Keep ACTIVE/OUT_OF_STOCK in sync without touching DISCONTINUED/ARCHIVED.
  if (stockAfter <= 0) {
    await tx.product.updateMany({
      where: { id: input.productId, status: 'ACTIVE' },
      data: { status: 'OUT_OF_STOCK' },
    });
  } else {
    await tx.product.updateMany({
      where: { id: input.productId, status: 'OUT_OF_STOCK' },
      data: { status: 'ACTIVE' },
    });
  }

  return { stockBefore, stockAfter };
}
