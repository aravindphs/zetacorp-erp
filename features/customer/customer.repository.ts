import 'server-only';

/**
 * Customer data access (spec §60 — repository layer: database only, no business
 * logic). Read builders + write primitives that accept a transaction client so
 * the service can compose them atomically.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { notDeleted } from '@/lib/db-helpers';
import type { CustomerListQuery } from '@/features/customer/customer.schema';

type Db = Prisma.TransactionClient | typeof prisma;

const SORTABLE = new Set([
  'customerCode',
  'customerName',
  'companyName',
  'phone',
  'gstNumber',
  'status',
  'createdAt',
]);

function buildWhere(query: CustomerListQuery): Prisma.CustomerWhereInput {
  const insensitive = Prisma.QueryMode.insensitive;
  const where: Prisma.CustomerWhereInput = { isDeleted: false };

  if (query.status) where.status = query.status;
  if (query.customerType) where.customerType = query.customerType;
  if (query.gstRegistered === 'yes') where.gstNumber = { not: null };
  if (query.gstRegistered === 'no') where.gstNumber = null;
  if (query.city) {
    where.addresses = { some: { isDeleted: false, city: { contains: query.city, mode: insensitive } } };
  }
  if (query.search) {
    const contains = { contains: query.search, mode: insensitive };
    where.OR = [
      { customerName: contains },
      { customerCode: contains },
      { companyName: contains },
      { phone: contains },
      { email: contains },
      { gstNumber: contains },
    ];
  }
  return where;
}

function buildOrderBy(query: CustomerListQuery): Prisma.CustomerOrderByWithRelationInput {
  const field = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';
  return { [field]: query.sortOrder };
}

export async function listCustomers(query: CustomerListQuery) {
  const where = buildWhere(query);
  const [items, total] = await Promise.all([
    prisma.customer.findMany({
      where,
      orderBy: buildOrderBy(query),
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        companyName: true,
        phone: true,
        gstNumber: true,
        customerType: true,
        status: true,
        createdAt: true,
        addresses: {
          where: { isDeleted: false },
          select: { city: true, isDefault: true, addressType: true },
          take: 1,
          orderBy: { isDefault: 'desc' },
        },
      },
    }),
    prisma.customer.count({ where }),
  ]);
  return { items, total };
}

/** All customers matching the filters (no pagination), for export (spec §126). */
export function listCustomersForExport(query: CustomerListQuery, limit = 5000) {
  return prisma.customer.findMany({
    where: buildWhere(query),
    orderBy: buildOrderBy(query),
    take: limit,
    select: {
      id: true,
      customerCode: true,
      customerName: true,
      companyName: true,
      customerType: true,
      phone: true,
      alternatePhone: true,
      email: true,
      gstNumber: true,
      panNumber: true,
      status: true,
      createdAt: true,
      addresses: {
        where: { isDeleted: false },
        select: { city: true, state: true, isDefault: true },
        take: 1,
        orderBy: { isDefault: 'desc' },
      },
    },
  });
}

/** Sum of outstanding balances per customer, for a set of customer ids. */
export async function outstandingByCustomer(customerIds: string[]): Promise<Map<string, number>> {
  if (customerIds.length === 0) return new Map();
  const grouped = await prisma.invoice.groupBy({
    by: ['customerId'],
    where: { customerId: { in: customerIds }, isDeleted: false, status: 'POSTED' },
    _sum: { balanceDue: true },
  });
  return new Map(grouped.map((g) => [g.customerId, g._sum.balanceDue?.toNumber() ?? 0]));
}

export function getCustomerById(id: string) {
  return prisma.customer.findFirst({ where: { id, ...notDeleted } });
}

export function getCustomerDetail(id: string) {
  return prisma.customer.findFirst({
    where: { id, ...notDeleted },
    include: {
      addresses: { where: { isDeleted: false }, orderBy: [{ isDefault: 'desc' }, { createdAt: 'asc' }] },
    },
  });
}

export interface DuplicateMatch {
  field: 'phone' | 'email' | 'gstNumber' | 'panNumber';
  id: string;
  customerCode: string;
  customerName: string;
}

/** Find existing customers colliding on any unique-ish field (spec §124). */
export async function findDuplicates(
  fields: { phone?: string; email?: string; gstNumber?: string; panNumber?: string },
  excludeId?: string,
): Promise<DuplicateMatch[]> {
  const or: Prisma.CustomerWhereInput[] = [];
  if (fields.phone) or.push({ phone: fields.phone });
  if (fields.email) or.push({ email: fields.email });
  if (fields.gstNumber) or.push({ gstNumber: fields.gstNumber });
  if (fields.panNumber) or.push({ panNumber: fields.panNumber });
  if (or.length === 0) return [];

  const rows = await prisma.customer.findMany({
    where: { isDeleted: false, ...(excludeId ? { id: { not: excludeId } } : {}), OR: or },
    select: { id: true, customerCode: true, customerName: true, phone: true, email: true, gstNumber: true, panNumber: true },
  });

  const matches: DuplicateMatch[] = [];
  for (const r of rows) {
    if (fields.phone && r.phone === fields.phone)
      matches.push({ field: 'phone', id: r.id, customerCode: r.customerCode, customerName: r.customerName });
    if (fields.email && r.email === fields.email)
      matches.push({ field: 'email', id: r.id, customerCode: r.customerCode, customerName: r.customerName });
    if (fields.gstNumber && r.gstNumber === fields.gstNumber)
      matches.push({ field: 'gstNumber', id: r.id, customerCode: r.customerCode, customerName: r.customerName });
    if (fields.panNumber && r.panNumber === fields.panNumber)
      matches.push({ field: 'panNumber', id: r.id, customerCode: r.customerCode, customerName: r.customerName });
  }
  return matches;
}

export function countActiveInvoices(customerId: string): Promise<number> {
  return prisma.invoice.count({ where: { customerId, isDeleted: false } });
}

export function insertCustomer(db: Db, data: Prisma.CustomerCreateInput) {
  return db.customer.create({ data });
}

export function updateCustomerRow(db: Db, id: string, data: Prisma.CustomerUpdateInput) {
  return db.customer.update({ where: { id }, data });
}
