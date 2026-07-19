/**
 * Product & stock validation (spec §141, §142, §145).
 */
import { z } from 'zod';
import { ProductStatus } from '@prisma/client';
import { listQuerySchema, nonEmptyString, optionalString, uuidSchema } from '@/schemas/common';
import { PRODUCT_UNITS } from '@/constants/inventory';

const money = z.coerce.number().min(0, 'Must be 0 or more.');
const optionalMoney = z.coerce.number().min(0).optional();
const qty = z.coerce.number().min(0, 'Must be 0 or more.');

const productBase = z.object({
  productName: nonEmptyString(200),
  categoryId: uuidSchema,
  brand: optionalString(100),
  model: optionalString(100),
  description: optionalString(2000),
  sku: optionalString(100),
  hsnCode: optionalString(20),
  gstPercentage: z.coerce.number().min(0, 'GST must be 0–28%.').max(28, 'GST must be 0–28%.').default(0),
  unit: z.enum(PRODUCT_UNITS).default('Nos'),
  purchasePrice: money.default(0),
  sellingPrice: money.default(0),
  discountPercentage: z.coerce.number().min(0).max(100).default(0),
  minimumSellingPrice: optionalMoney,
  mrp: optionalMoney,
  minimumStock: qty.default(0),
  maximumStock: z.coerce.number().min(0).optional(),
  reorderLevel: z.coerce.number().min(0).optional(),
  imageUrl: optionalString(500),
  datasheetUrl: optionalString(500),
  status: z.nativeEnum(ProductStatus).default(ProductStatus.ACTIVE),
});

export const createProductSchema = productBase.extend({
  openingStock: qty.default(0),
});

export const updateProductSchema = productBase;

export const productListQuerySchema = listQuerySchema.extend({
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
  lowStock: z.enum(['yes']).optional(),
});

export const adjustStockSchema = z.object({
  productId: uuidSchema,
  transactionType: z.enum(['ADJUSTMENT', 'DAMAGE', 'RETURN', 'MANUAL_CORRECTION', 'PURCHASE']),
  /** Signed change to stock (positive adds, negative removes). */
  quantity: z.coerce.number().refine((v) => v !== 0, 'Quantity cannot be zero.'),
  reason: nonEmptyString(200),
  remarks: optionalString(500),
});

export type CreateProductFormInput = z.input<typeof createProductSchema>;
export type CreateProductInput = z.output<typeof createProductSchema>;
export type UpdateProductInput = z.infer<typeof updateProductSchema>;
export type ProductListQuery = z.infer<typeof productListQuerySchema>;
export type AdjustStockInput = z.infer<typeof adjustStockSchema>;
