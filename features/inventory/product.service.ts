import 'server-only';

/**
 * Product business logic (spec §153, §154). Code generation, opening-stock
 * transaction on create, stock adjustment (always via the stock engine), and
 * soft delete (blocked when invoice history exists).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { generateCode } from '@/lib/code-generator';
import { applyStockMovement } from '@/services/stock.service';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { buildPaginationMeta } from '@/lib/pagination';
import { BusinessRuleError, NotFoundError } from '@/lib/errors';
import { CODE_PREFIX } from '@/constants/app';
import type { AuthUser } from '@/types/auth';
import type {
  AdjustStockInput,
  CreateProductInput,
  ProductListQuery,
  UpdateProductInput,
} from '@/features/inventory/product.schema';
import {
  countInvoiceItems,
  listProducts,
  getProductById,
} from '@/features/inventory/product.repository';

export async function getProductList(query: ProductListQuery) {
  const { items, total } = await listProducts(query);
  const rows = items.map((p) => ({
    id: p.id,
    productCode: p.productCode,
    productName: p.productName,
    brand: p.brand,
    category: p.category.name,
    unit: p.unit,
    sellingPrice: p.sellingPrice.toNumber(),
    gstPercentage: p.gstPercentage.toNumber(),
    currentStock: p.currentStock.toNumber(),
    minimumStock: p.minimumStock.toNumber(),
    lowStock: p.currentStock.lessThanOrEqualTo(p.minimumStock),
    status: p.status,
  }));
  return { rows, meta: buildPaginationMeta(query, total) };
}

export async function createProduct(user: AuthUser, input: CreateProductInput) {
  const { openingStock, ...fields } = input;

  const product = await prisma.$transaction(async (tx) => {
    const code = await generateCode(tx, { key: 'product', prefix: CODE_PREFIX.PRODUCT });
    const created = await tx.product.create({
      data: {
        productCode: code,
        productName: fields.productName,
        categoryId: fields.categoryId,
        brand: fields.brand,
        model: fields.model,
        description: fields.description,
        sku: fields.sku,
        hsnCode: fields.hsnCode,
        gstPercentage: fields.gstPercentage,
        unit: fields.unit,
        purchasePrice: fields.purchasePrice,
        sellingPrice: fields.sellingPrice,
        discountPercentage: fields.discountPercentage,
        minimumSellingPrice: fields.minimumSellingPrice,
        mrp: fields.mrp,
        minimumStock: fields.minimumStock,
        maximumStock: fields.maximumStock,
        reorderLevel: fields.reorderLevel,
        imageUrl: fields.imageUrl,
        datasheetUrl: fields.datasheetUrl,
        status: fields.status,
        currentStock: 0,
        ...auditCreate(user.id),
      },
    });

    if (openingStock > 0) {
      await applyStockMovement(tx, {
        productId: created.id,
        type: 'OPENING_STOCK',
        delta: openingStock,
        referenceType: 'product',
        referenceId: created.id,
        remarks: 'Opening stock',
        userId: user.id,
      });
    }

    await logAudit(
      { userId: user.id, action: 'CREATE', module: 'inventory', referenceId: created.id, newValue: { productCode: code, productName: created.productName } },
      tx,
    );
    return created;
  });

  await logActivity({ userId: user.id, activity: `Created product ${product.productCode}`, module: 'inventory', referenceId: product.id });
  return product;
}

export async function updateProduct(user: AuthUser, id: string, input: UpdateProductInput) {
  const existing = await getProductById(id);
  if (!existing) throw new NotFoundError('Product not found.');

  const product = await prisma.product.update({
    where: { id },
    data: {
      productName: input.productName,
      categoryId: input.categoryId,
      brand: input.brand,
      model: input.model,
      description: input.description,
      sku: input.sku,
      hsnCode: input.hsnCode,
      gstPercentage: input.gstPercentage,
      unit: input.unit,
      purchasePrice: input.purchasePrice,
      sellingPrice: input.sellingPrice,
      discountPercentage: input.discountPercentage,
      minimumSellingPrice: input.minimumSellingPrice,
      mrp: input.mrp,
      minimumStock: input.minimumStock,
      maximumStock: input.maximumStock,
      reorderLevel: input.reorderLevel,
      imageUrl: input.imageUrl,
      datasheetUrl: input.datasheetUrl,
      status: input.status,
      ...auditUpdate(user.id),
    },
  });
  await logActivity({ userId: user.id, activity: `Updated product ${product.productCode}`, module: 'inventory', referenceId: id });
  return product;
}

export async function adjustStock(user: AuthUser, input: AdjustStockInput) {
  const product = await getProductById(input.productId);
  if (!product) throw new NotFoundError('Product not found.');

  const projected = product.currentStock.toNumber() + input.quantity;
  if (projected < 0) {
    throw new BusinessRuleError(
      `Adjustment would make stock negative (current ${product.currentStock.toNumber()}).`,
    );
  }

  const result = await prisma.$transaction(async (tx) => {
    const movement = await applyStockMovement(tx, {
      productId: input.productId,
      type: input.transactionType,
      delta: input.quantity,
      referenceType: 'adjustment',
      referenceId: null,
      remarks: `${input.reason}${input.remarks ? ` — ${input.remarks}` : ''}`,
      userId: user.id,
    });
    await logAudit(
      {
        userId: user.id,
        action: 'STOCK_ADJUSTMENT',
        module: 'inventory',
        referenceId: input.productId,
        oldValue: { stock: movement.stockBefore },
        newValue: { stock: movement.stockAfter, reason: input.reason, type: input.transactionType },
      },
      tx,
    );
    return movement;
  });

  await logActivity({
    userId: user.id,
    activity: `Adjusted stock of ${product.productCode} (${input.quantity > 0 ? '+' : ''}${input.quantity})`,
    module: 'inventory',
    referenceId: input.productId,
  });
  return result;
}

export async function deleteProduct(user: AuthUser, id: string, reason: string) {
  const existing = await getProductById(id);
  if (!existing) throw new NotFoundError('Product not found.');

  const invoiceItems = await countInvoiceItems(id);
  if (invoiceItems > 0) {
    throw new BusinessRuleError(
      'This product has invoice history and cannot be deleted. Archive it instead.',
    );
  }

  await prisma.$transaction(async (tx) => {
    await tx.product.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit({ userId: user.id, action: 'DELETE', module: 'inventory', referenceId: id, oldValue: { productCode: existing.productCode, reason } }, tx);
  });
  await logActivity({ userId: user.id, activity: `Deleted product ${existing.productCode} (${reason})`, module: 'inventory', referenceId: id });
}

/** Product options for invoice/quotation line pickers (active, in-stock-aware). */
export async function getProductOptions(search: string): Promise<
  {
    id: string;
    productCode: string;
    productName: string;
    unit: string;
    sellingPrice: number;
    gstPercentage: number;
    hsnCode: string | null;
    currentStock: number;
    status: string;
  }[]
> {
  const where: Prisma.ProductWhereInput = {
    isDeleted: false,
    status: { in: ['ACTIVE', 'OUT_OF_STOCK'] },
  };
  if (search.trim()) {
    const contains = { contains: search, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ productName: contains }, { productCode: contains }, { sku: contains }];
  }
  const products = await prisma.product.findMany({
    where,
    take: 20,
    orderBy: { productName: 'asc' },
    select: {
      id: true,
      productCode: true,
      productName: true,
      unit: true,
      sellingPrice: true,
      gstPercentage: true,
      hsnCode: true,
      currentStock: true,
      status: true,
    },
  });
  return products.map((p) => ({
    id: p.id,
    productCode: p.productCode,
    productName: p.productName,
    unit: p.unit,
    sellingPrice: p.sellingPrice.toNumber(),
    gstPercentage: p.gstPercentage.toNumber(),
    hsnCode: p.hsnCode,
    currentStock: p.currentStock.toNumber(),
    status: p.status,
  }));
}
