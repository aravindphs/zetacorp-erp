/**
 * Inventory constants (spec §139, §140, §144).
 */
import type { InventoryTransactionType, ProductStatus } from '@prisma/client';

/** Supported units (spec §140). Admin-configurable in a future release. */
export const PRODUCT_UNITS = [
  'Nos',
  'Kg',
  'Meter',
  'Feet',
  'Liter',
  'Pack',
  'Set',
  'Box',
  'Roll',
] as const;

export const PRODUCT_STATUS_LABELS: Record<ProductStatus, string> = {
  ACTIVE: 'Active',
  OUT_OF_STOCK: 'Out of stock',
  DISCONTINUED: 'Discontinued',
  ARCHIVED: 'Archived',
};

export const PRODUCT_STATUS_CLASSES: Record<ProductStatus, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  OUT_OF_STOCK: 'bg-destructive/10 text-destructive',
  DISCONTINUED: 'bg-amber-500/10 text-amber-600',
  ARCHIVED: 'bg-muted text-muted-foreground',
};

export const STOCK_TXN_LABELS: Record<InventoryTransactionType, string> = {
  PURCHASE: 'Purchase',
  SALE: 'Sale',
  ADJUSTMENT: 'Adjustment',
  DAMAGE: 'Damage',
  RETURN: 'Return',
  MANUAL_CORRECTION: 'Manual correction',
  OPENING_STOCK: 'Opening stock',
};

/** Adjustment reasons a user can pick (spec §145). */
export const ADJUSTMENT_TYPES: InventoryTransactionType[] = [
  'ADJUSTMENT',
  'DAMAGE',
  'RETURN',
  'MANUAL_CORRECTION',
  'PURCHASE',
];
