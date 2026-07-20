import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { QuotationListQuery } from '@/features/quotation/quotation.schema';

const SORTABLE = new Set(['quotationNumber', 'quotationDate', 'grandTotal', 'validUntil', 'createdAt']);

export async function getQuotationList(query: QuotationListQuery) {
  const where: Prisma.QuotationWhereInput = { isDeleted: false };
  if (query.status) where.status = query.status;
  if (query.customerId) where.customerId = query.customerId;
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { quotationNumber: contains },
      { referenceNumber: contains },
      { customer: { customerName: contains } },
    ];
  }
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';

  const [items, total] = await Promise.all([
    prisma.quotation.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        quotationNumber: true,
        quotationDate: true,
        validUntil: true,
        status: true,
        grandTotal: true,
        customer: { select: { customerName: true } },
      },
    }),
    prisma.quotation.count({ where }),
  ]);

  const rows = items.map((q) => ({
    id: q.id,
    quotationNumber: q.quotationNumber,
    customerName: q.customer.customerName,
    quotationDate: q.quotationDate.toISOString(),
    validUntil: q.validUntil?.toISOString() ?? null,
    status: q.status,
    grandTotal: q.grandTotal.toNumber(),
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export function getQuotationDetail(id: string) {
  return prisma.quotation.findFirst({
    where: { id, isDeleted: false },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          customerName: true,
          companyName: true,
          phone: true,
          gstNumber: true,
          addresses: { where: { isDeleted: false }, orderBy: { isDefault: 'desc' } },
        },
      },
      items: { orderBy: { sortOrder: 'asc' } },
    },
  });
}
