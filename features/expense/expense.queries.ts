import 'server-only';

/**
 * Expense read models (spec §300, §302, §306). Independent reads run in
 * parallel and every list is paginated.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import { listPendingForApprover } from '@/services/approval.service';
import type { ExpenseListQuery } from '@/features/expense/expense.schema';
import type { ExpenseRow } from '@/features/expense/expense.types';
import type { AuthUser } from '@/types/auth';

const SORTABLE = new Set(['expenseNumber', 'expenseDate', 'amount', 'createdAt']);

async function buildWhere(
  query: ExpenseListQuery,
  user: AuthUser,
): Promise<Prisma.ExpenseWhereInput> {
  const where: Prisma.ExpenseWhereInput = { isDeleted: false };

  if (query.mine) where.employeeId = user.id;
  else if (query.employeeId) where.employeeId = query.employeeId;

  if (query.status) where.status = query.status;
  if (query.expenseCategoryId) where.expenseCategoryId = query.expenseCategoryId;
  if (query.fromDate || query.toDate) {
    where.expenseDate = {};
    if (query.fromDate) where.expenseDate.gte = new Date(query.fromDate);
    if (query.toDate) where.expenseDate.lte = new Date(query.toDate);
  }
  if (query.minAmount !== undefined || query.maxAmount !== undefined) {
    where.amount = {};
    if (query.minAmount !== undefined) where.amount.gte = query.minAmount;
    if (query.maxAmount !== undefined) where.amount.lte = query.maxAmount;
  }
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { expenseNumber: contains },
      { description: contains },
      { vendorName: contains },
      { referenceNumber: contains },
      { employee: { fullName: contains } },
    ];
  }

  // "Pending my approval" (§296) — the engine decides which claims qualify.
  if (query.pendingMine) {
    const ids = await listPendingForApprover('expense', user);
    where.id = { in: ids };
    where.status = 'PENDING';
  }

  return where;
}

async function approverNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

export async function getExpenseList(query: ExpenseListQuery, user: AuthUser) {
  const where = await buildWhere(query, user);
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';

  const [items, total] = await Promise.all([
    prisma.expense.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        expenseNumber: true,
        employeeId: true,
        expenseDate: true,
        amount: true,
        currency: true,
        status: true,
        createdAt: true,
        approvedBy: true,
        reimbursedAt: true,
        employee: { select: { fullName: true } },
        category: { select: { name: true } },
      },
    }),
    prisma.expense.count({ where }),
  ]);

  const nameById = await approverNames(items.map((e) => e.approvedBy));

  const rows: ExpenseRow[] = items.map((e) => ({
    id: e.id,
    expenseNumber: e.expenseNumber,
    employeeId: e.employeeId,
    employeeName: e.employee.fullName,
    categoryName: e.category.name,
    expenseDate: e.expenseDate.toISOString(),
    amount: e.amount.toNumber(),
    currency: e.currency,
    status: e.status,
    submittedDate: e.createdAt.toISOString(),
    approverName: e.approvedBy ? (nameById.get(e.approvedBy) ?? null) : null,
    reimbursedAt: e.reimbursedAt?.toISOString() ?? null,
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export function getExpenseDetail(id: string) {
  return prisma.expense.findFirst({
    where: { id, isDeleted: false },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          department: { select: { name: true } },
        },
      },
      category: { select: { id: true, name: true } },
      receipts: { where: { isDeleted: false }, orderBy: { createdAt: 'desc' } },
      transactions: { orderBy: { createdAt: 'desc' } },
    },
  });
}

/** Dashboard widgets (§300) — counts and sums issued in parallel. */
export async function getExpenseDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const inMonth = { gte: monthStart, lte: monthEnd };

  const [pending, approved, rejected, reimbursed, claimTotal, reimbursedTotal, byCategory] =
    await Promise.all([
      prisma.expense.count({ where: { isDeleted: false, status: 'PENDING' } }),
      prisma.expense.count({
        where: { isDeleted: false, status: 'APPROVED', approvedAt: inMonth },
      }),
      prisma.expense.count({
        where: { isDeleted: false, status: 'REJECTED', approvedAt: inMonth },
      }),
      prisma.expense.count({
        where: { isDeleted: false, status: 'REIMBURSED', reimbursedAt: inMonth },
      }),
      prisma.expense.aggregate({
        where: { isDeleted: false, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        _sum: { amount: true },
      }),
      prisma.expense.aggregate({
        where: { isDeleted: false, status: 'REIMBURSED' },
        _sum: { amount: true },
      }),
      prisma.expense.groupBy({
        by: ['expenseCategoryId'],
        where: { isDeleted: false, status: { notIn: ['CANCELLED', 'REJECTED'] } },
        _sum: { amount: true },
      }),
    ]);

  // Resolve category names for the breakdown (§300).
  const categoryIds = byCategory.map((c) => c.expenseCategoryId);
  const categories = categoryIds.length
    ? await prisma.expenseCategory.findMany({
        where: { id: { in: categoryIds } },
        select: { id: true, name: true },
      })
    : [];
  const nameById = new Map(categories.map((c) => [c.id, c.name]));

  return {
    pending,
    approvedThisMonth: approved,
    rejectedThisMonth: rejected,
    reimbursedThisMonth: reimbursed,
    totalClaimAmount: claimTotal._sum.amount?.toNumber() ?? 0,
    totalReimbursedAmount: reimbursedTotal._sum.amount?.toNumber() ?? 0,
    categoryBreakdown: byCategory
      .map((c) => ({
        categoryName: nameById.get(c.expenseCategoryId) ?? 'Unknown',
        amount: c._sum.amount?.toNumber() ?? 0,
      }))
      .sort((a, b) => b.amount - a.amount),
  };
}

/** Active categories for the submit form. */
export function getExpenseCategoryOptions() {
  return prisma.expenseCategory.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true },
  });
}
