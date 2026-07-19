import 'server-only';

/**
 * Derived customer reads (spec §113 summary, §120 ledger, §122 timeline). All
 * computed dynamically from transactions — nothing is stored redundantly
 * (spec §128 "ledger generated dynamically").
 */
import { prisma } from '@/lib/prisma';

export interface CustomerSummary {
  totalQuotations: number;
  totalInvoices: number;
  totalRevenue: number;
  outstanding: number;
  lastPurchaseDate: string | null;
  averageInvoiceValue: number;
  customerSince: string;
}

export async function getCustomerSummary(customerId: string, createdAt: Date): Promise<CustomerSummary> {
  const [quotationCount, invoiceAgg, outstandingAgg, lastInvoice] = await Promise.all([
    prisma.quotation.count({ where: { customerId, isDeleted: false } }),
    prisma.invoice.aggregate({
      where: { customerId, isDeleted: false, status: 'POSTED' },
      _count: { _all: true },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { customerId, isDeleted: false, status: 'POSTED' },
      _sum: { balanceDue: true },
    }),
    prisma.invoice.findFirst({
      where: { customerId, isDeleted: false, status: 'POSTED' },
      orderBy: { invoiceDate: 'desc' },
      select: { invoiceDate: true },
    }),
  ]);

  const totalInvoices = invoiceAgg._count._all;
  const totalRevenue = invoiceAgg._sum.grandTotal?.toNumber() ?? 0;

  return {
    totalQuotations: quotationCount,
    totalInvoices,
    totalRevenue,
    outstanding: outstandingAgg._sum.balanceDue?.toNumber() ?? 0,
    lastPurchaseDate: lastInvoice?.invoiceDate.toISOString() ?? null,
    averageInvoiceValue: totalInvoices > 0 ? Number((totalRevenue / totalInvoices).toFixed(2)) : 0,
    customerSince: createdAt.toISOString(),
  };
}

export interface LedgerEntry {
  date: string;
  type: 'INVOICE' | 'PAYMENT';
  reference: string;
  debit: number;
  credit: number;
  balance: number;
}

export async function getCustomerLedger(customerId: string): Promise<LedgerEntry[]> {
  const [invoices, payments] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId, isDeleted: false, status: 'POSTED' },
      select: { invoiceNumber: true, invoiceDate: true, grandTotal: true },
    }),
    prisma.payment.findMany({
      where: { customerId, isDeleted: false, status: 'SUCCESS' },
      select: { paymentNumber: true, paymentDate: true, amount: true },
    }),
  ]);

  const raw = [
    ...invoices.map((i) => ({
      date: i.invoiceDate,
      type: 'INVOICE' as const,
      reference: i.invoiceNumber,
      debit: i.grandTotal.toNumber(),
      credit: 0,
    })),
    ...payments.map((p) => ({
      date: p.paymentDate,
      type: 'PAYMENT' as const,
      reference: p.paymentNumber,
      debit: 0,
      credit: p.amount.toNumber(),
    })),
  ].sort((a, b) => a.date.getTime() - b.date.getTime());

  let balance = 0;
  return raw.map((e) => {
    balance += e.debit - e.credit;
    return {
      date: e.date.toISOString(),
      type: e.type,
      reference: e.reference,
      debit: e.debit,
      credit: e.credit,
      balance: Number(balance.toFixed(2)),
    };
  });
}

export interface CustomerRelatedLists {
  quotations: { id: string; number: string; status: string; amount: number; date: string }[];
  invoices: {
    id: string;
    number: string;
    status: string;
    total: number;
    paid: number;
    outstanding: number;
    date: string;
  }[];
  payments: {
    id: string;
    number: string;
    method: string;
    reference: string | null;
    amount: number;
    date: string;
  }[];
}

/** Related documents shown on the customer detail tabs (spec §117–§119). */
export async function getCustomerRelatedLists(customerId: string): Promise<CustomerRelatedLists> {
  const [quotations, invoices, payments] = await Promise.all([
    prisma.quotation.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: { id: true, quotationNumber: true, status: true, grandTotal: true, quotationDate: true },
    }),
    prisma.invoice.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        invoiceNumber: true,
        paymentStatus: true,
        grandTotal: true,
        amountPaid: true,
        balanceDue: true,
        invoiceDate: true,
      },
    }),
    prisma.payment.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 25,
      select: {
        id: true,
        paymentNumber: true,
        paymentMethod: true,
        referenceNumber: true,
        amount: true,
        paymentDate: true,
      },
    }),
  ]);

  return {
    quotations: quotations.map((q) => ({
      id: q.id,
      number: q.quotationNumber,
      status: q.status,
      amount: q.grandTotal.toNumber(),
      date: q.quotationDate.toISOString(),
    })),
    invoices: invoices.map((i) => ({
      id: i.id,
      number: i.invoiceNumber,
      status: i.paymentStatus,
      total: i.grandTotal.toNumber(),
      paid: i.amountPaid.toNumber(),
      outstanding: i.balanceDue.toNumber(),
      date: i.invoiceDate.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      number: p.paymentNumber,
      method: p.paymentMethod,
      reference: p.referenceNumber,
      amount: p.amount.toNumber(),
      date: p.paymentDate.toISOString(),
    })),
  };
}

export interface TimelineEvent {
  id: string;
  label: string;
  detail: string;
  date: string;
}

export async function getCustomerTimeline(customerId: string): Promise<TimelineEvent[]> {
  const [activities, invoices, quotations, payments] = await Promise.all([
    prisma.activityLog.findMany({
      where: { module: 'customer', referenceId: customerId },
      orderBy: { createdAt: 'desc' },
      take: 30,
      select: { id: true, activity: true, createdAt: true },
    }),
    prisma.invoice.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, invoiceNumber: true, createdAt: true },
    }),
    prisma.quotation.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, quotationNumber: true, createdAt: true },
    }),
    prisma.payment.findMany({
      where: { customerId, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 15,
      select: { id: true, paymentNumber: true, createdAt: true },
    }),
  ]);

  const events: TimelineEvent[] = [
    ...activities.map((a) => ({ id: `a-${a.id}`, label: a.activity, detail: 'Customer', date: a.createdAt.toISOString() })),
    ...invoices.map((i) => ({ id: `i-${i.id}`, label: 'Invoice created', detail: i.invoiceNumber, date: i.createdAt.toISOString() })),
    ...quotations.map((q) => ({ id: `q-${q.id}`, label: 'Quotation created', detail: q.quotationNumber, date: q.createdAt.toISOString() })),
    ...payments.map((p) => ({ id: `p-${p.id}`, label: 'Payment received', detail: p.paymentNumber, date: p.createdAt.toISOString() })),
  ];

  return events.sort((a, b) => b.date.localeCompare(a.date)).slice(0, 40);
}
