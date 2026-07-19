import 'server-only';

/**
 * Dashboard aggregation service (spec §80–§90, §94–§96).
 *
 * Queries are permission-scoped (spec §99): financial aggregates (sales,
 * revenue, outstanding) require `report.view`; approval counts require the
 * relevant approve permission. Reads run in parallel and use Prisma
 * aggregation / groupBy, with targeted raw SQL only where SQL features are
 * needed (date bucketing, column-to-column comparison for low stock).
 */
import { Prisma } from '@prisma/client';
import {
  eachMonthOfInterval,
  endOfMonth,
  format,
  startOfDay,
  startOfMonth,
  subDays,
  subMonths,
} from 'date-fns';
import { prisma } from '@/lib/prisma';
import { hasPermission } from '@/lib/auth/guards';
import type { AuthUser } from '@/types/auth';
import type {
  ChartRange,
  DashboardAlerts,
  DashboardCharts,
  DashboardRecent,
  DashboardSummary,
  MonthlyRevenuePoint,
  SalesTrendPoint,
} from '@/features/dashboard/dashboard.types';

function decToNum(value: Prisma.Decimal | null | undefined): number {
  return value ? value.toNumber() : 0;
}

function pctChange(current: number, previous: number): number | null {
  if (previous === 0) return current === 0 ? 0 : null;
  return Number((((current - previous) / previous) * 100).toFixed(1));
}

const POSTED = { status: 'POSTED', isDeleted: false } as const;

// ---------------------------------------------------------------------------
// Summary (stat cards)
// ---------------------------------------------------------------------------

export async function getDashboardSummary(user: AuthUser): Promise<DashboardSummary> {
  const now = new Date();
  const todayStart = startOfDay(now);
  const yesterdayStart = startOfDay(subDays(now, 1));
  const monthStart = startOfMonth(now);
  const lastMonthStart = startOfMonth(subMonths(now, 1));
  const lastMonthEnd = monthStart;

  const canViewFinancials = hasPermission(user, 'report.view');
  const canApproveExpenses = hasPermission(user, 'expense.approve');
  const canApproveLeave = hasPermission(user, 'leave.approve');

  const [
    totalActiveCustomers,
    newCustomersThisMonth,
    availableProducts,
    lowStockCount,
    invoicesToday,
    invoicesThisMonth,
  ] = await Promise.all([
    prisma.customer.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
    prisma.customer.count({ where: { isDeleted: false, createdAt: { gte: monthStart } } }),
    prisma.product.count({ where: { isDeleted: false, status: 'ACTIVE' } }),
    lowStockProductCount(),
    prisma.invoice.count({ where: { ...POSTED, invoiceDate: { gte: todayStart } } }),
    prisma.invoice.count({ where: { ...POSTED, invoiceDate: { gte: monthStart } } }),
  ]);

  let todaySalesValue = 0;
  let yesterdaySalesValue = 0;
  let monthRevenue = 0;
  let lastMonthRevenue = 0;
  let outstandingPending = 0;
  let outstandingOverdue = 0;

  if (canViewFinancials) {
    const [todayAgg, yesterdayAgg, monthAgg, lastMonthAgg, pendingAgg, overdueAgg] =
      await Promise.all([
        prisma.invoice.aggregate({
          _sum: { grandTotal: true },
          where: { ...POSTED, invoiceDate: { gte: todayStart } },
        }),
        prisma.invoice.aggregate({
          _sum: { grandTotal: true },
          where: { ...POSTED, invoiceDate: { gte: yesterdayStart, lt: todayStart } },
        }),
        prisma.invoice.aggregate({
          _sum: { grandTotal: true },
          where: { ...POSTED, invoiceDate: { gte: monthStart } },
        }),
        prisma.invoice.aggregate({
          _sum: { grandTotal: true },
          where: { ...POSTED, invoiceDate: { gte: lastMonthStart, lt: lastMonthEnd } },
        }),
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: { ...POSTED, paymentStatus: { in: ['UNPAID', 'PARTIAL', 'OVERDUE'] } },
        }),
        prisma.invoice.aggregate({
          _sum: { balanceDue: true },
          where: { ...POSTED, paymentStatus: 'OVERDUE' },
        }),
      ]);
    todaySalesValue = decToNum(todayAgg._sum.grandTotal);
    yesterdaySalesValue = decToNum(yesterdayAgg._sum.grandTotal);
    monthRevenue = decToNum(monthAgg._sum.grandTotal);
    lastMonthRevenue = decToNum(lastMonthAgg._sum.grandTotal);
    outstandingPending = decToNum(pendingAgg._sum.balanceDue);
    outstandingOverdue = decToNum(overdueAgg._sum.balanceDue);
  }

  const [pendingExpenses, pendingLeave] = await Promise.all([
    canApproveExpenses
      ? prisma.expense.count({ where: { isDeleted: false, status: 'PENDING' } })
      : Promise.resolve(null),
    canApproveLeave
      ? prisma.leaveRequest.count({ where: { isDeleted: false, status: 'PENDING' } })
      : Promise.resolve(null),
  ]);

  return {
    customers: { totalActive: totalActiveCustomers, newThisMonth: newCustomersThisMonth },
    products: { available: availableProducts, lowStock: lowStockCount },
    todaySales: { value: todaySalesValue, changePercent: pctChange(todaySalesValue, yesterdaySalesValue) },
    outstanding: { pending: outstandingPending, overdue: outstandingOverdue },
    monthlyRevenue: { value: monthRevenue, changePercent: pctChange(monthRevenue, lastMonthRevenue) },
    invoices: { today: invoicesToday, thisMonth: invoicesThisMonth },
    pendingExpenses,
    pendingLeave,
  };
}

async function lowStockProductCount(): Promise<number> {
  const rows = await prisma.$queryRaw<{ count: number }[]>(
    Prisma.sql`SELECT COUNT(*)::int AS count FROM products
               WHERE is_deleted = false AND current_stock <= minimum_stock`,
  );
  return rows[0]?.count ?? 0;
}

// ---------------------------------------------------------------------------
// Charts
// ---------------------------------------------------------------------------

export async function getDashboardCharts(user: AuthUser, range: ChartRange): Promise<DashboardCharts> {
  const canViewFinancials = hasPermission(user, 'report.view');

  const [salesTrend, revenueByMonth, paymentStatus, topProducts, inventoryByCategory] =
    await Promise.all([
      canViewFinancials ? getSalesTrend(range) : Promise.resolve([]),
      canViewFinancials ? getRevenueByMonth() : Promise.resolve([]),
      canViewFinancials ? getPaymentStatus() : Promise.resolve([]),
      getTopProducts(),
      getInventoryByCategory(),
    ]);

  return { salesTrend, revenueByMonth, paymentStatus, topProducts, inventoryByCategory };
}

const RANGE_DAYS: Record<ChartRange, number> = {
  today: 1,
  week: 7,
  month: 30,
  quarter: 90,
  year: 365,
};

async function getSalesTrend(range: ChartRange): Promise<SalesTrendPoint[]> {
  const days = RANGE_DAYS[range];
  const useMonthly = days > 90;
  const since = startOfDay(subDays(new Date(), days - 1));

  const rows = await prisma.$queryRaw<{ bucket: Date; revenue: number; invoices: number }[]>(
    Prisma.sql`
      SELECT date_trunc(${useMonthly ? 'month' : 'day'}, invoice_date) AS bucket,
             COALESCE(SUM(grand_total), 0)::float AS revenue,
             COUNT(*)::int AS invoices
      FROM invoices
      WHERE is_deleted = false AND status = 'POSTED' AND invoice_date >= ${since}
      GROUP BY bucket
      ORDER BY bucket`,
  );

  return rows.map((r) => ({
    label: format(r.bucket, useMonthly ? 'MMM yyyy' : 'dd MMM'),
    revenue: r.revenue,
    invoices: r.invoices,
    averageSale: r.invoices > 0 ? Number((r.revenue / r.invoices).toFixed(2)) : 0,
  }));
}

async function getRevenueByMonth(): Promise<MonthlyRevenuePoint[]> {
  const now = new Date();
  const start = startOfMonth(subMonths(now, 11));

  const rows = await prisma.$queryRaw<{ bucket: Date; revenue: number }[]>(
    Prisma.sql`
      SELECT date_trunc('month', invoice_date) AS bucket,
             COALESCE(SUM(grand_total), 0)::float AS revenue
      FROM invoices
      WHERE is_deleted = false AND status = 'POSTED' AND invoice_date >= ${start}
      GROUP BY bucket`,
  );

  const byKey = new Map(rows.map((r) => [format(r.bucket, 'yyyy-MM'), r.revenue]));
  return eachMonthOfInterval({ start, end: endOfMonth(now) }).map((month) => ({
    month: format(month, 'MMM yy'),
    revenue: byKey.get(format(month, 'yyyy-MM')) ?? 0,
  }));
}

async function getPaymentStatus(): Promise<DashboardCharts['paymentStatus']> {
  const grouped = await prisma.invoice.groupBy({
    by: ['paymentStatus'],
    where: POSTED,
    _count: { _all: true },
    _sum: { grandTotal: true },
  });
  return grouped.map((g) => ({
    status: g.paymentStatus,
    count: g._count._all,
    amount: decToNum(g._sum.grandTotal),
  }));
}

async function getTopProducts(): Promise<DashboardCharts['topProducts']> {
  const grouped = await prisma.invoiceItem.groupBy({
    by: ['productId'],
    _sum: { quantity: true, lineTotal: true },
    orderBy: { _sum: { lineTotal: 'desc' } },
    take: 10,
  });
  const ids = grouped.map((g) => g.productId).filter((id): id is string => Boolean(id));
  const products = await prisma.product.findMany({
    where: { id: { in: ids } },
    select: { id: true, productName: true },
  });
  const nameById = new Map(products.map((p) => [p.id, p.productName]));

  return grouped.map((g) => ({
    productId: g.productId,
    name: g.productId ? (nameById.get(g.productId) ?? 'Unknown') : 'Custom item',
    quantity: decToNum(g._sum.quantity),
    revenue: decToNum(g._sum.lineTotal),
  }));
}

async function getInventoryByCategory(): Promise<DashboardCharts['inventoryByCategory']> {
  const grouped = await prisma.product.groupBy({
    by: ['categoryId'],
    where: { isDeleted: false },
    _sum: { currentStock: true },
  });
  const categories = await prisma.category.findMany({
    where: { id: { in: grouped.map((g) => g.categoryId) } },
    select: { id: true, name: true },
  });
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return grouped
    .map((g) => ({
      categoryId: g.categoryId,
      name: nameById.get(g.categoryId) ?? 'Uncategorised',
      stock: decToNum(g._sum.currentStock),
    }))
    .filter((c) => c.stock > 0);
}

// ---------------------------------------------------------------------------
// Recent lists
// ---------------------------------------------------------------------------

export async function getDashboardRecent(user: AuthUser): Promise<DashboardRecent> {
  const canViewFinancials = hasPermission(user, 'report.view');

  const [invoices, payments, customers, activities] = await Promise.all([
    prisma.invoice.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        invoiceNumber: true,
        grandTotal: true,
        paymentStatus: true,
        invoiceDate: true,
        customer: { select: { customerName: true } },
      },
    }),
    canViewFinancials
      ? prisma.payment.findMany({
          where: { isDeleted: false },
          orderBy: { createdAt: 'desc' },
          take: 10,
          select: {
            id: true,
            paymentNumber: true,
            amount: true,
            paymentMethod: true,
            paymentDate: true,
            customer: { select: { customerName: true } },
            invoice: { select: { invoiceNumber: true } },
          },
        })
      : Promise.resolve([]),
    prisma.customer.findMany({
      where: { isDeleted: false },
      orderBy: { createdAt: 'desc' },
      take: 5,
      select: { id: true, customerName: true, phone: true, createdAt: true },
    }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 20,
      select: { id: true, activity: true, module: true, createdAt: true, userId: true },
    }),
  ]);

  const userIds = [...new Set(activities.map((a) => a.userId).filter((id): id is string => Boolean(id)))];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));

  return {
    invoices: invoices.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customer.customerName,
      grandTotal: decToNum(i.grandTotal),
      paymentStatus: i.paymentStatus,
      invoiceDate: i.invoiceDate.toISOString(),
    })),
    payments: payments.map((p) => ({
      id: p.id,
      paymentNumber: p.paymentNumber,
      customerName: p.customer.customerName,
      invoiceNumber: p.invoice.invoiceNumber,
      method: p.paymentMethod,
      amount: decToNum(p.amount),
      paymentDate: p.paymentDate.toISOString(),
    })),
    customers: customers.map((c) => ({
      id: c.id,
      customerName: c.customerName,
      phone: c.phone,
      createdAt: c.createdAt.toISOString(),
    })),
    activities: activities.map((a) => ({
      id: a.id,
      userName: a.userId ? (nameById.get(a.userId) ?? 'System') : 'System',
      activity: a.activity,
      module: a.module,
      createdAt: a.createdAt.toISOString(),
    })),
  };
}

/** Recent user activity feed (spec §86), used by the activities endpoint. */
export async function getDashboardActivities(): Promise<DashboardRecent['activities']> {
  const activities = await prisma.activityLog.findMany({
    orderBy: { createdAt: 'desc' },
    take: 20,
    select: { id: true, activity: true, module: true, createdAt: true, userId: true },
  });
  const userIds = [
    ...new Set(activities.map((a) => a.userId).filter((id): id is string => Boolean(id))),
  ];
  const users = await prisma.user.findMany({
    where: { id: { in: userIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(users.map((u) => [u.id, u.fullName]));
  return activities.map((a) => ({
    id: a.id,
    userName: a.userId ? (nameById.get(a.userId) ?? 'System') : 'System',
    activity: a.activity,
    module: a.module,
    createdAt: a.createdAt.toISOString(),
  }));
}

// ---------------------------------------------------------------------------
// Alerts
// ---------------------------------------------------------------------------

export async function getDashboardAlerts(user: AuthUser): Promise<DashboardAlerts> {
  const canViewInventory = hasPermission(user, 'inventory.view');
  const canApproveExpenses = hasPermission(user, 'expense.approve');
  const canApproveLeave = hasPermission(user, 'leave.approve');

  const lowStock = canViewInventory
    ? await prisma.$queryRaw<
        { id: string; productName: string; categoryName: string; currentStock: number; minimumStock: number }[]
      >(
        Prisma.sql`
          SELECT p.id, p.product_name AS "productName", c.name AS "categoryName",
                 p.current_stock::float AS "currentStock", p.minimum_stock::float AS "minimumStock"
          FROM products p
          JOIN categories c ON c.id = p.category_id
          WHERE p.is_deleted = false AND p.current_stock <= p.minimum_stock
          ORDER BY (p.minimum_stock - p.current_stock) DESC
          LIMIT 10`,
      )
    : [];

  const [expenses, leave] = await Promise.all([
    canApproveExpenses
      ? prisma.expense.count({ where: { isDeleted: false, status: 'PENDING' } })
      : Promise.resolve(null),
    canApproveLeave
      ? prisma.leaveRequest.count({ where: { isDeleted: false, status: 'PENDING' } })
      : Promise.resolve(null),
  ]);

  return { lowStock, pendingApprovals: { expenses, leave } };
}
