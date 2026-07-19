import 'server-only';

import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { InvoiceListQuery } from '@/features/invoice/invoice.schema';

const SORTABLE = new Set(['invoiceNumber', 'invoiceDate', 'grandTotal', 'dueDate', 'createdAt']);

export async function getInvoiceList(query: InvoiceListQuery) {
  const where: Prisma.InvoiceWhereInput = { isDeleted: false };
  if (query.status) where.status = query.status;
  if (query.paymentStatus) where.paymentStatus = query.paymentStatus;
  if (query.customerId) where.customerId = query.customerId;
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { invoiceNumber: contains },
      { referenceNumber: contains },
      { customer: { customerName: contains } },
    ];
  }
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';

  const [items, total] = await Promise.all([
    prisma.invoice.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        status: true,
        paymentStatus: true,
        grandTotal: true,
        balanceDue: true,
        customer: { select: { customerName: true } },
      },
    }),
    prisma.invoice.count({ where }),
  ]);

  const rows = items.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    customerName: i.customer.customerName,
    invoiceDate: i.invoiceDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? null,
    status: i.status,
    paymentStatus: i.paymentStatus,
    grandTotal: i.grandTotal.toNumber(),
    balanceDue: i.balanceDue.toNumber(),
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export function getInvoiceDetail(id: string) {
  return prisma.invoice.findFirst({
    where: { id, isDeleted: false },
    include: {
      customer: {
        select: {
          id: true,
          customerCode: true,
          customerName: true,
          companyName: true,
          phone: true,
          email: true,
          gstNumber: true,
          addresses: { where: { isDeleted: false }, orderBy: { isDefault: 'desc' } },
        },
      },
      items: { orderBy: { sortOrder: 'asc' } },
      payments: {
        where: { isDeleted: false },
        orderBy: { paymentDate: 'desc' },
        select: {
          id: true,
          paymentNumber: true,
          amount: true,
          paymentMethod: true,
          referenceNumber: true,
          paymentDate: true,
          status: true,
        },
      },
    },
  });
}
