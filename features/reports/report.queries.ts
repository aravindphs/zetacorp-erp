import 'server-only';

/**
 * Report aggregations (spec §321–§331, §340).
 *
 * Performance rules for this file: use `aggregate`/`groupBy`/`count` so the
 * database does the work, never load a large result set into memory, always
 * bound by a date range, and issue independent queries with `Promise.all`.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import {
  resolveRange,
  type AuditReportQuery,
  type CustomerReportQuery,
  type EmployeeReportQuery,
  type ExpenseReportQuery,
  type InventoryReportQuery,
  type InvoiceReportQuery,
  type LeaveReportQuery,
  type PaymentReportQuery,
  type SalesReportQuery,
} from '@/features/reports/report.schema';

const dec = (v: Prisma.Decimal | null | undefined) => v?.toNumber() ?? 0;

/** Resolve user ids to names in one query (audit columns are scalar UUIDs). */
async function namesByUserId(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

// --- Executive dashboard (§321) -------------------------------------------

export async function getExecutiveReport() {
  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const yearStart = new Date(now.getFullYear(), 0, 1);

  const posted = { isDeleted: false, status: 'POSTED' as const };

  const [
    revenueToday,
    revenueMonth,
    revenueYear,
    outstanding,
    invoicesCreated,
    paymentsReceived,
    topCustomers,
    lowStock,
    pendingLeave,
    pendingExpenses,
    recentActivity,
  ] = await Promise.all([
    prisma.invoice.aggregate({
      where: { ...posted, invoiceDate: { gte: todayStart } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { ...posted, invoiceDate: { gte: monthStart } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({
      where: { ...posted, invoiceDate: { gte: yearStart } },
      _sum: { grandTotal: true },
    }),
    prisma.invoice.aggregate({ where: posted, _sum: { balanceDue: true } }),
    prisma.invoice.count({ where: { isDeleted: false, invoiceDate: { gte: monthStart } } }),
    prisma.payment.aggregate({
      where: { isDeleted: false, status: 'SUCCESS', paymentDate: { gte: monthStart } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.invoice.groupBy({
      by: ['customerId'],
      where: posted,
      _sum: { grandTotal: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 5,
    }),
    prisma.product.findMany({
      where: {
        isDeleted: false,
        status: 'ACTIVE',
        minimumStock: { gt: 0 },
        currentStock: { lte: prisma.product.fields.minimumStock },
      },
      orderBy: { currentStock: 'asc' },
      take: 5,
      select: { id: true, productCode: true, productName: true, currentStock: true, minimumStock: true },
    }),
    prisma.leaveRequest.count({ where: { isDeleted: false, status: 'PENDING' } }),
    prisma.expense.count({ where: { isDeleted: false, status: 'PENDING' } }),
    prisma.activityLog.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: { id: true, activity: true, module: true, createdAt: true, userId: true },
    }),
  ]);

  // Resolve names for the two lists that need them.
  const [customerNames, activityNames] = await Promise.all([
    topCustomers.length
      ? prisma.customer.findMany({
          where: { id: { in: topCustomers.map((c) => c.customerId) } },
          select: { id: true, customerName: true },
        })
      : Promise.resolve([]),
    namesByUserId(recentActivity.map((a) => a.userId)),
  ]);
  const customerNameById = new Map(customerNames.map((c) => [c.id, c.customerName]));

  return {
    revenueToday: dec(revenueToday._sum.grandTotal),
    revenueThisMonth: dec(revenueMonth._sum.grandTotal),
    revenueThisYear: dec(revenueYear._sum.grandTotal),
    outstandingAmount: dec(outstanding._sum.balanceDue),
    invoicesCreatedThisMonth: invoicesCreated,
    paymentsReceivedThisMonth: dec(paymentsReceived._sum.amount),
    paymentCountThisMonth: paymentsReceived._count,
    topCustomers: topCustomers.map((c) => ({
      customerId: c.customerId,
      customerName: customerNameById.get(c.customerId) ?? 'Unknown',
      total: dec(c._sum.grandTotal),
    })),
    lowStockItems: lowStock.map((p) => ({
      id: p.id,
      productCode: p.productCode,
      productName: p.productName,
      currentStock: dec(p.currentStock),
      minimumStock: dec(p.minimumStock),
    })),
    pendingLeaveRequests: pendingLeave,
    pendingExpenseClaims: pendingExpenses,
    recentActivities: recentActivity.map((a) => ({
      id: a.id,
      activity: a.activity,
      module: a.module,
      createdAt: a.createdAt.toISOString(),
      userName: a.userId ? (activityNames.get(a.userId) ?? 'System') : 'System',
    })),
  };
}

// --- Sales (§323) ----------------------------------------------------------

export async function getSalesReport(query: SalesReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.InvoiceWhereInput = {
    isDeleted: false,
    status: 'POSTED',
    invoiceDate: { gte: from, lte: to },
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };

  const [totals, topProducts, byMonth] = await Promise.all([
    prisma.invoice.aggregate({
      where,
      _count: true,
      _sum: { grandTotal: true, gstAmount: true, taxableAmount: true },
      _avg: { grandTotal: true },
    }),
    prisma.invoiceItem.groupBy({
      by: ['productName'],
      where: { invoice: where, ...(query.productId ? { productId: query.productId } : {}) },
      _sum: { quantity: true, lineTotal: true },
      orderBy: { _sum: { lineTotal: 'desc' } },
      take: 10,
    }),
    // Monthly trend for the chart — aggregated in SQL, not in JS (§340).
    prisma.$queryRaw<{ month: Date; total: Prisma.Decimal; count: bigint }[]>`
      SELECT date_trunc('month', invoice_date) AS month,
             SUM(grand_total) AS total,
             COUNT(*) AS count
      FROM invoices
      WHERE is_deleted = false
        AND status = 'POSTED'
        AND invoice_date BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1`,
  ]);

  return {
    invoiceCount: totals._count,
    salesAmount: dec(totals._sum.grandTotal),
    taxCollected: dec(totals._sum.gstAmount),
    taxableAmount: dec(totals._sum.taxableAmount),
    averageInvoiceValue: dec(totals._avg.grandTotal),
    topProducts: topProducts.map((p) => ({
      productName: p.productName,
      quantity: dec(p._sum.quantity),
      total: dec(p._sum.lineTotal),
    })),
    trend: byMonth.map((m) => ({
      month: m.month.toISOString().slice(0, 7),
      total: Number(m.total ?? 0),
      count: Number(m.count),
    })),
  };
}

// --- Customers (§324) ------------------------------------------------------

export async function getCustomerReport(query: CustomerReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.CustomerWhereInput = {
    isDeleted: false,
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, newCustomers, active, outstanding, topCustomers] = await Promise.all([
    prisma.customer.count({ where }),
    prisma.customer.count({ where: { ...where, createdAt: { gte: from, lte: to } } }),
    prisma.customer.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.invoice.aggregate({
      where: { isDeleted: false, status: 'POSTED' },
      _sum: { balanceDue: true },
    }),
    prisma.invoice.groupBy({
      by: ['customerId'],
      where: { isDeleted: false, status: 'POSTED' },
      _sum: { grandTotal: true, balanceDue: true },
      _max: { invoiceDate: true },
      orderBy: { _sum: { grandTotal: 'desc' } },
      take: 20,
    }),
  ]);

  const names = topCustomers.length
    ? await prisma.customer.findMany({
        where: { id: { in: topCustomers.map((c) => c.customerId) } },
        select: { id: true, customerName: true, customerCode: true },
      })
    : [];
  const byId = new Map(names.map((c) => [c.id, c]));

  return {
    customerCount: total,
    newCustomers,
    activeCustomers: active,
    outstandingBalance: dec(outstanding._sum.balanceDue),
    rows: topCustomers.map((c) => ({
      customerId: c.customerId,
      customerName: byId.get(c.customerId)?.customerName ?? 'Unknown',
      customerCode: byId.get(c.customerId)?.customerCode ?? '—',
      totalPurchases: dec(c._sum.grandTotal),
      outstanding: dec(c._sum.balanceDue),
      lastPurchase: c._max.invoiceDate?.toISOString() ?? null,
    })),
  };
}

// --- Inventory (§325) ------------------------------------------------------

export async function getInventoryReport(query: InventoryReportQuery) {
  const where: Prisma.ProductWhereInput = {
    isDeleted: false,
    ...(query.categoryId ? { categoryId: query.categoryId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [totals, lowStock, outOfStock, fastMoving, products] = await Promise.all([
    prisma.product.aggregate({ where, _count: true }),
    prisma.product.count({
      where: { ...where, minimumStock: { gt: 0 }, currentStock: { lte: prisma.product.fields.minimumStock } },
    }),
    prisma.product.count({ where: { ...where, currentStock: { lte: 0 } } }),
    prisma.invoiceItem.groupBy({
      by: ['productName'],
      where: { invoice: { isDeleted: false, status: 'POSTED' } },
      _sum: { quantity: true },
      orderBy: { _sum: { quantity: 'desc' } },
      take: 10,
    }),
    prisma.product.findMany({
      where,
      orderBy: { currentStock: 'asc' },
      take: 50,
      select: {
        id: true,
        productCode: true,
        productName: true,
        currentStock: true,
        minimumStock: true,
        purchasePrice: true,
        sellingPrice: true,
      },
    }),
  ]);

  // Inventory value = stock × purchase price, summed in SQL.
  const valueRows = await prisma.$queryRaw<{ value: Prisma.Decimal | null }[]>`
    SELECT SUM(current_stock * purchase_price) AS value
    FROM products
    WHERE is_deleted = false`;
  const inventoryValue = Number(valueRows[0]?.value ?? 0);

  return {
    productCount: totals._count,
    inventoryValue,
    lowStockCount: lowStock,
    outOfStockCount: outOfStock,
    fastMoving: fastMoving.map((p) => ({
      productName: p.productName,
      quantitySold: dec(p._sum.quantity),
    })),
    rows: products.map((p) => ({
      id: p.id,
      productCode: p.productCode,
      productName: p.productName,
      currentStock: dec(p.currentStock),
      minimumStock: dec(p.minimumStock),
      stockValue: dec(p.currentStock) * dec(p.purchasePrice),
    })),
  };
}

// --- Invoices (§326) -------------------------------------------------------

export async function getInvoiceReport(query: InvoiceReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.InvoiceWhereInput = {
    isDeleted: false,
    invoiceDate: { gte: from, lte: to },
    ...(query.status ? { status: query.status } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };

  const [totals, byStatus, rows] = await Promise.all([
    prisma.invoice.aggregate({
      where,
      _count: true,
      _sum: { grandTotal: true, gstAmount: true, balanceDue: true },
    }),
    prisma.invoice.groupBy({ by: ['paymentStatus'], where, _count: true, _sum: { grandTotal: true } }),
    prisma.invoice.findMany({
      where,
      orderBy: { invoiceDate: 'desc' },
      take: 100,
      select: {
        id: true,
        invoiceNumber: true,
        invoiceDate: true,
        dueDate: true,
        grandTotal: true,
        gstAmount: true,
        balanceDue: true,
        status: true,
        paymentStatus: true,
        customer: { select: { customerName: true } },
      },
    }),
  ]);

  return {
    invoiceCount: totals._count,
    totalAmount: dec(totals._sum.grandTotal),
    totalGst: dec(totals._sum.gstAmount),
    totalOutstanding: dec(totals._sum.balanceDue),
    byPaymentStatus: byStatus.map((s) => ({
      status: s.paymentStatus,
      count: s._count,
      total: dec(s._sum.grandTotal),
    })),
    rows: rows.map((i) => ({
      id: i.id,
      invoiceNumber: i.invoiceNumber,
      customerName: i.customer.customerName,
      invoiceDate: i.invoiceDate.toISOString(),
      dueDate: i.dueDate?.toISOString() ?? null,
      grandTotal: dec(i.grandTotal),
      gstAmount: dec(i.gstAmount),
      balanceDue: dec(i.balanceDue),
      status: i.status,
      paymentStatus: i.paymentStatus,
    })),
  };
}

// --- Payments (§327) -------------------------------------------------------

export async function getPaymentReport(query: PaymentReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.PaymentWhereInput = {
    isDeleted: false,
    status: 'SUCCESS',
    paymentDate: { gte: from, lte: to },
    ...(query.method ? { paymentMethod: query.method } : {}),
    ...(query.customerId ? { customerId: query.customerId } : {}),
  };

  const [totals, byMethod, outstanding] = await Promise.all([
    prisma.payment.aggregate({ where, _count: true, _sum: { amount: true }, _avg: { amount: true } }),
    prisma.payment.groupBy({
      by: ['paymentMethod'],
      where,
      _count: true,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.invoice.aggregate({
      where: { isDeleted: false, status: 'POSTED' },
      _sum: { balanceDue: true },
    }),
  ]);

  return {
    paymentCount: totals._count,
    collectionAmount: dec(totals._sum.amount),
    averagePayment: dec(totals._avg.amount),
    outstandingCollection: dec(outstanding._sum.balanceDue),
    byMethod: byMethod.map((m) => ({
      method: m.paymentMethod,
      count: m._count,
      total: dec(m._sum.amount),
    })),
  };
}

// --- Employees (§328) ------------------------------------------------------

export async function getEmployeeReport(query: EmployeeReportQuery) {
  const where: Prisma.UserWhereInput = {
    isDeleted: false,
    ...(query.departmentId ? { departmentId: query.departmentId } : {}),
    ...(query.roleId ? { roleId: query.roleId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [total, active, inactive, byDepartment, byRole, recentLogins] = await Promise.all([
    prisma.user.count({ where }),
    prisma.user.count({ where: { ...where, status: 'ACTIVE' } }),
    prisma.user.count({ where: { ...where, status: { not: 'ACTIVE' } } }),
    prisma.user.groupBy({ by: ['departmentId'], where, _count: true }),
    prisma.user.groupBy({ by: ['roleId'], where, _count: true }),
    prisma.user.findMany({
      where: { ...where, lastLoginAt: { not: null } },
      orderBy: { lastLoginAt: 'desc' },
      take: 10,
      select: { id: true, fullName: true, employeeCode: true, lastLoginAt: true },
    }),
  ]);

  const [departments, roles] = await Promise.all([
    prisma.department.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
    prisma.role.findMany({ where: { isDeleted: false }, select: { id: true, name: true } }),
  ]);
  const deptById = new Map(departments.map((d) => [d.id, d.name]));
  const roleById = new Map(roles.map((r) => [r.id, r.name]));

  return {
    employeeCount: total,
    activeEmployees: active,
    inactiveEmployees: inactive,
    byDepartment: byDepartment.map((d) => ({
      name: d.departmentId ? (deptById.get(d.departmentId) ?? 'Unknown') : 'Unassigned',
      count: d._count,
    })),
    byRole: byRole.map((r) => ({ name: roleById.get(r.roleId) ?? 'Unknown', count: r._count })),
    recentLogins: recentLogins.map((u) => ({
      id: u.id,
      fullName: u.fullName,
      employeeCode: u.employeeCode,
      lastLoginAt: u.lastLoginAt?.toISOString() ?? null,
    })),
  };
}

// --- Leave (§329) ----------------------------------------------------------

export async function getLeaveReport(query: LeaveReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.LeaveRequestWhereInput = {
    isDeleted: false,
    fromDate: { lte: to },
    toDate: { gte: from },
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.leaveTypeId ? { leaveTypeId: query.leaveTypeId } : {}),
    ...(query.status ? { status: query.status } : {}),
    ...(query.departmentId ? { employee: { departmentId: query.departmentId } } : {}),
  };

  const [byStatus, byType, byDepartment] = await Promise.all([
    prisma.leaveRequest.groupBy({ by: ['status'], where, _count: true, _sum: { totalDays: true } }),
    prisma.leaveRequest.groupBy({
      by: ['leaveTypeId'],
      where,
      _count: true,
      _sum: { totalDays: true },
    }),
    prisma.$queryRaw<{ name: string | null; count: bigint; days: Prisma.Decimal | null }[]>`
      SELECT d.name, COUNT(l.id) AS count, SUM(l.total_days) AS days
      FROM leave_requests l
      JOIN users u ON u.id = l.employee_id
      LEFT JOIN departments d ON d.id = u.department_id
      WHERE l.is_deleted = false
        AND l.from_date <= ${to}
        AND l.to_date >= ${from}
      GROUP BY d.name
      ORDER BY count DESC`,
  ]);

  const types = byType.length
    ? await prisma.leaveType.findMany({
        where: { id: { in: byType.map((t) => t.leaveTypeId) } },
        select: { id: true, name: true },
      })
    : [];
  const typeById = new Map(types.map((t) => [t.id, t.name]));

  const statusCount = (s: string) => byStatus.find((b) => b.status === s)?._count ?? 0;

  return {
    approved: statusCount('APPROVED'),
    rejected: statusCount('REJECTED'),
    pending: statusCount('PENDING'),
    totalDays: byStatus.reduce((sum, s) => sum + dec(s._sum.totalDays), 0),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s._count,
      days: dec(s._sum.totalDays),
    })),
    byType: byType.map((t) => ({
      name: typeById.get(t.leaveTypeId) ?? 'Unknown',
      count: t._count,
      days: dec(t._sum.totalDays),
    })),
    byDepartment: byDepartment.map((d) => ({
      name: d.name ?? 'Unassigned',
      count: Number(d.count),
      days: Number(d.days ?? 0),
    })),
  };
}

// --- Expenses (§330) -------------------------------------------------------

export async function getExpenseReport(query: ExpenseReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.ExpenseWhereInput = {
    isDeleted: false,
    expenseDate: { gte: from, lte: to },
    ...(query.expenseCategoryId ? { expenseCategoryId: query.expenseCategoryId } : {}),
    ...(query.employeeId ? { employeeId: query.employeeId } : {}),
    ...(query.status ? { status: query.status } : {}),
  };

  const [byStatus, byCategory, trend] = await Promise.all([
    prisma.expense.groupBy({ by: ['status'], where, _count: true, _sum: { amount: true } }),
    prisma.expense.groupBy({
      by: ['expenseCategoryId'],
      where,
      _count: true,
      _sum: { amount: true },
      orderBy: { _sum: { amount: 'desc' } },
    }),
    prisma.$queryRaw<{ month: Date; total: Prisma.Decimal | null }[]>`
      SELECT date_trunc('month', expense_date) AS month, SUM(amount) AS total
      FROM expenses
      WHERE is_deleted = false
        AND expense_date BETWEEN ${from} AND ${to}
      GROUP BY 1
      ORDER BY 1`,
  ]);

  const categories = byCategory.length
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: byCategory.map((c) => c.expenseCategoryId) } },
        select: { id: true, name: true },
      })
    : [];
  const catById = new Map(categories.map((c) => [c.id, c.name]));

  const sumFor = (s: string) => dec(byStatus.find((b) => b.status === s)?._sum.amount);

  return {
    submittedAmount: byStatus.reduce((sum, s) => sum + dec(s._sum.amount), 0),
    approvedAmount: sumFor('APPROVED'),
    rejectedAmount: sumFor('REJECTED'),
    reimbursedAmount: sumFor('REIMBURSED'),
    byStatus: byStatus.map((s) => ({
      status: s.status,
      count: s._count,
      total: dec(s._sum.amount),
    })),
    byCategory: byCategory.map((c) => ({
      name: catById.get(c.expenseCategoryId) ?? 'Unknown',
      count: c._count,
      total: dec(c._sum.amount),
    })),
    trend: trend.map((t) => ({
      month: t.month.toISOString().slice(0, 7),
      total: Number(t.total ?? 0),
    })),
  };
}

// --- Audit (§331) ----------------------------------------------------------

export async function getAuditReport(query: AuditReportQuery) {
  const { from, to } = resolveRange(query);
  const where: Prisma.AuditLogWhereInput = {
    createdAt: { gte: from, lte: to },
    ...(query.userId ? { userId: query.userId } : {}),
    ...(query.module ? { module: query.module } : {}),
    ...(query.action ? { action: query.action } : {}),
  };

  const [rows, total, byAction] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        module: true,
        referenceId: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
    prisma.auditLog.groupBy({
      by: ['action'],
      where,
      _count: true,
      orderBy: { _count: { action: 'desc' } },
      take: 10,
    }),
  ]);

  const nameById = await namesByUserId(rows.map((r) => r.userId));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      module: r.module,
      referenceId: r.referenceId,
      userName: r.userId ? (nameById.get(r.userId) ?? 'System') : 'System',
      createdAt: r.createdAt.toISOString(),
    })),
    byAction: byAction.map((a) => ({ action: a.action, count: a._count })),
    meta: buildPaginationMeta({ page: query.page, pageSize: query.pageSize }, total),
  };
}

// --- Filter option helpers -------------------------------------------------

export async function getReportFilterOptions() {
  const [customers, categories, departments, roles, leaveTypes, expenseCategories] =
    await Promise.all([
      prisma.customer.findMany({
        where: { isDeleted: false },
        orderBy: { customerName: 'asc' },
        take: 200,
        select: { id: true, customerName: true },
      }),
      prisma.category.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.department.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.role.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.leaveType.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
      prisma.expenseCategory.findMany({
        where: { isDeleted: false },
        orderBy: { name: 'asc' },
        select: { id: true, name: true },
      }),
    ]);

  return { customers, categories, departments, roles, leaveTypes, expenseCategories };
}
