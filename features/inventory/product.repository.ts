import 'server-only';

/**
 * Product data access (spec §60). Read builders + write primitives.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notDeleted } from '@/lib/db-helpers';
import type { ProductListQuery } from '@/features/inventory/product.schema';

type Db = Prisma.TransactionClient | typeof prisma;

const SORTABLE = new Set(['productCode', 'productName', 'sellingPrice', 'currentStock', 'status', 'createdAt']);

async function lowStockIds(): Promise<string[]> {
  const rows = await prisma.$queryRaw<{ id: string }[]>(
    Prisma.sql`SELECT id FROM products WHERE is_deleted = false AND current_stock <= minimum_stock`,
  );
  return rows.map((r) => r.id);
}

async function buildWhere(query: ProductListQuery): Promise<Prisma.ProductWhereInput> {
  const where: Prisma.ProductWhereInput = { isDeleted: false };
  if (query.categoryId) where.categoryId = query.categoryId;
  if (query.status) where.status = query.status;
  if (query.lowStock === 'yes') where.id = { in: await lowStockIds() };
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { productName: contains },
      { productCode: contains },
      { brand: contains },
      { hsnCode: contains },
      { sku: contains },
    ];
  }
  return where;
}

export async function listProducts(query: ProductListQuery) {
  const where = await buildWhere(query);
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';
  const [items, total] = await Promise.all([
    prisma.product.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        productCode: true,
        productName: true,
        brand: true,
        unit: true,
        sellingPrice: true,
        gstPercentage: true,
        currentStock: true,
        minimumStock: true,
        status: true,
        category: { select: { name: true } },
      },
    }),
    prisma.product.count({ where }),
  ]);
  return { items, total };
}

export function listProductsForExport(query: ProductListQuery, limit = 5000) {
  return (async () => {
    const where = await buildWhere(query);
    return prisma.product.findMany({
      where,
      orderBy: { productCode: 'asc' },
      take: limit,
      select: {
        productCode: true,
        productName: true,
        brand: true,
        model: true,
        hsnCode: true,
        sku: true,
        unit: true,
        purchasePrice: true,
        sellingPrice: true,
        gstPercentage: true,
        currentStock: true,
        minimumStock: true,
        status: true,
        category: { select: { name: true } },
      },
    });
  })();
}

export function getProductById(id: string) {
  return prisma.product.findFirst({ where: { id, ...notDeleted } });
}

export function getProductDetail(id: string) {
  return prisma.product.findFirst({
    where: { id, ...notDeleted },
    include: { category: { select: { id: true, name: true } } },
  });
}

export function insertProduct(db: Db, data: Prisma.ProductCreateInput) {
  return db.product.create({ data });
}

export function countInvoiceItems(productId: string): Promise<number> {
  return prisma.invoiceItem.count({ where: { productId } });
}
