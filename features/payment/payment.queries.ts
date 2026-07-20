import 'server-only';

/**
 * Payment read models (spec §223, §225, §231). Payments are immutable financial
 * records; these queries never mutate. "Received By" resolves the `createdBy`
 * audit UUID to a user name (audit columns are scalar UUIDs, not FK relations).
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { PaymentListQuery } from '@/features/payment/payment.schema';
import type { OutstandingInvoice, PaymentRow } from '@/features/payment/payment.types';

const SORTABLE = new Set(['paymentNumber', 'paymentDate', 'amount', 'createdAt']);

/** Resolve a set of createdBy UUIDs to display names ("System" when unknown). */
async function namesByUserId(ids: (string | null)[]): Promise<Map<string, string>> {
  const userIds = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (userIds.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

function buildWhere(query: PaymentListQuery): Prisma.PaymentWhereInput {
  const where: Prisma.PaymentWhereInput = { isDeleted: false };
  if (query.status) where.status = query.status;
  if (query.method) where.paymentMethod = query.method;
  if (query.customerId) where.customerId = query.customerId;
  if (query.dateFrom || query.dateTo) {
    where.paymentDate = {};
    if (query.dateFrom) where.paymentDate.gte = new Date(query.dateFrom);
    if (query.dateTo) where.paymentDate.lte = new Date(query.dateTo);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { paymentNumber: contains },
      { referenceNumber: contains },
      { invoice: { invoiceNumber: contains } },
      { customer: { customerName: contains } },
    ];
  }
  return where;
}

export async function getPaymentList(query: PaymentListQuery) {
  const where = buildWhere(query);
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'paymentDate';

  const [items, total] = await Promise.all([
    prisma.payment.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        paymentNumber: true,
        paymentDate: true,
        paymentMethod: true,
        referenceNumber: true,
        amount: true,
        status: true,
        createdBy: true,
        customer: { select: { id: true, customerName: true } },
        invoice: { select: { id: true, invoiceNumber: true } },
      },
    }),
    prisma.payment.count({ where }),
  ]);

  const nameById = await namesByUserId(items.map((p) => p.createdBy));

  const rows: PaymentRow[] = items.map((p) => ({
    id: p.id,
    paymentNumber: p.paymentNumber,
    customerId: p.customer.id,
    customerName: p.customer.customerName,
    invoiceId: p.invoice.id,
    invoiceNumber: p.invoice.invoiceNumber,
    paymentDate: p.paymentDate.toISOString(),
    paymentMethod: p.paymentMethod,
    referenceNumber: p.referenceNumber,
    amount: p.amount.toNumber(),
    status: p.status,
    receivedBy: p.createdBy ? (nameById.get(p.createdBy) ?? 'System') : 'System',
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

/** Full record for the detail page & receipt (spec §231). */
export async function getPaymentDetail(id: string) {
  const payment = await prisma.payment.findFirst({
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
      invoice: {
        select: {
          id: true,
          invoiceNumber: true,
          invoiceDate: true,
          dueDate: true,
          grandTotal: true,
          amountPaid: true,
          balanceDue: true,
          paymentStatus: true,
        },
      },
    },
  });
  if (!payment) return null;

  const nameById = await namesByUserId([payment.createdBy]);
  return {
    ...payment,
    receivedBy: payment.createdBy ? (nameById.get(payment.createdBy) ?? 'System') : 'System',
  };
}

/**
 * Posted invoices with an outstanding balance, for the record-payment picker
 * (spec §225). Paid/draft/cancelled invoices are excluded. Searchable by
 * invoice number, customer name, or phone.
 */
export async function getOutstandingInvoices(search: string): Promise<OutstandingInvoice[]> {
  const where: Prisma.InvoiceWhereInput = {
    isDeleted: false,
    status: 'POSTED',
    balanceDue: { gt: 0 },
  };
  const term = search.trim();
  if (term) {
    const contains = { contains: term, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { invoiceNumber: contains },
      { customer: { customerName: contains } },
      { customer: { phone: contains } },
    ];
  }

  const invoices = await prisma.invoice.findMany({
    where,
    orderBy: { invoiceDate: 'desc' },
    take: 20,
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      grandTotal: true,
      amountPaid: true,
      balanceDue: true,
      customer: { select: { id: true, customerName: true, phone: true } },
    },
  });

  return invoices.map((i) => ({
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? null,
    customerId: i.customer.id,
    customerName: i.customer.customerName,
    customerPhone: i.customer.phone,
    grandTotal: i.grandTotal.toNumber(),
    amountPaid: i.amountPaid.toNumber(),
    balanceDue: i.balanceDue.toNumber(),
  }));
}

/** Single posted invoice with a balance due, for pre-selecting the picker. */
export async function getOutstandingInvoiceById(id: string): Promise<OutstandingInvoice | null> {
  const i = await prisma.invoice.findFirst({
    where: { id, isDeleted: false, status: 'POSTED', balanceDue: { gt: 0 } },
    select: {
      id: true,
      invoiceNumber: true,
      invoiceDate: true,
      dueDate: true,
      grandTotal: true,
      amountPaid: true,
      balanceDue: true,
      customer: { select: { id: true, customerName: true, phone: true } },
    },
  });
  if (!i) return null;
  return {
    id: i.id,
    invoiceNumber: i.invoiceNumber,
    invoiceDate: i.invoiceDate.toISOString(),
    dueDate: i.dueDate?.toISOString() ?? null,
    customerId: i.customer.id,
    customerName: i.customer.customerName,
    customerPhone: i.customer.phone,
    grandTotal: i.grandTotal.toNumber(),
    amountPaid: i.amountPaid.toNumber(),
    balanceDue: i.balanceDue.toNumber(),
  };
}

/** Flat rows for CSV export honouring the active filters (spec §235, §236). */
export async function listPaymentsForExport(query: PaymentListQuery) {
  const where = buildWhere(query);
  const payments = await prisma.payment.findMany({
    where,
    orderBy: { paymentDate: 'desc' },
    take: 5000,
    select: {
      paymentNumber: true,
      paymentDate: true,
      paymentMethod: true,
      referenceNumber: true,
      amount: true,
      status: true,
      remarks: true,
      createdBy: true,
      customer: { select: { customerName: true } },
      invoice: { select: { invoiceNumber: true } },
    },
  });

  const nameById = await namesByUserId(payments.map((p) => p.createdBy));
  return payments.map((p) => ({
    paymentNumber: p.paymentNumber,
    customerName: p.customer.customerName,
    invoiceNumber: p.invoice.invoiceNumber,
    paymentDate: p.paymentDate.toISOString().slice(0, 10),
    method: p.paymentMethod,
    referenceNumber: p.referenceNumber ?? '',
    amount: p.amount.toNumber(),
    status: p.status,
    remarks: p.remarks ?? '',
    receivedBy: p.createdBy ? (nameById.get(p.createdBy) ?? 'System') : 'System',
  }));
}
