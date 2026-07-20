import 'server-only';

/**
 * Leave read models (spec §275, §276, §282, §283). Independent queries are
 * issued in parallel; every list is paginated or bounded.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { LeaveCalendarQuery, LeaveListQuery } from '@/features/leave/leave.schema';
import type { LeaveCalendarEntry, LeaveRow } from '@/features/leave/leave.types';
import type { AuthUser } from '@/types/auth';

const SORTABLE = new Set(['leaveNumber', 'fromDate', 'totalDays', 'createdAt']);

function buildWhere(query: LeaveListQuery, user: AuthUser): Prisma.LeaveRequestWhereInput {
  const where: Prisma.LeaveRequestWhereInput = { isDeleted: false };

  // "My Leave" (§276), or an explicit employee filter for admins/managers.
  if (query.mine) where.employeeId = user.id;
  else if (query.employeeId) where.employeeId = query.employeeId;

  if (query.status) where.status = query.status;
  if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
  if (query.departmentId) where.employee = { departmentId: query.departmentId };
  if (query.fromDate || query.toDate) {
    // Any request intersecting the window.
    if (query.toDate) where.fromDate = { lte: new Date(query.toDate) };
    if (query.fromDate) where.toDate = { gte: new Date(query.fromDate) };
  }
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { leaveNumber: contains },
      { reason: contains },
      { employee: { fullName: contains } },
    ];
  }
  return where;
}

/** Resolve approver ids (scalar audit column) to names. */
async function approverNames(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

export async function getLeaveList(query: LeaveListQuery, user: AuthUser) {
  const where = buildWhere(query, user);
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'createdAt';

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        leaveNumber: true,
        employeeId: true,
        fromDate: true,
        toDate: true,
        totalDays: true,
        isHalfDay: true,
        status: true,
        createdAt: true,
        approvedBy: true,
        employee: { select: { fullName: true } },
        leaveType: { select: { name: true } },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const nameById = await approverNames(items.map((l) => l.approvedBy));

  const rows: LeaveRow[] = items.map((l) => ({
    id: l.id,
    leaveNumber: l.leaveNumber,
    employeeId: l.employeeId,
    employeeName: l.employee.fullName,
    leaveTypeName: l.leaveType.name,
    fromDate: l.fromDate.toISOString(),
    toDate: l.toDate.toISOString(),
    totalDays: l.totalDays.toNumber(),
    isHalfDay: l.isHalfDay,
    status: l.status,
    appliedDate: l.createdAt.toISOString(),
    approverName: l.approvedBy ? (nameById.get(l.approvedBy) ?? null) : null,
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export function getLeaveDetail(id: string) {
  return prisma.leaveRequest.findFirst({
    where: { id, isDeleted: false },
    include: {
      employee: {
        select: {
          id: true,
          fullName: true,
          employeeCode: true,
          email: true,
          department: { select: { name: true } },
        },
      },
      leaveType: { select: { id: true, name: true, isPaid: true, requiresDocument: true } },
      delegate: { select: { id: true, fullName: true } },
    },
  });
}

/** Approved (and optionally pending) leave for a month (§282). */
export async function getLeaveCalendar(query: LeaveCalendarQuery): Promise<LeaveCalendarEntry[]> {
  const now = new Date();
  const year = query.year ?? now.getFullYear();
  const month = query.month ?? now.getMonth() + 1;

  // Inclusive month window.
  const monthStart = new Date(Date.UTC(year, month - 1, 1));
  const monthEnd = new Date(Date.UTC(year, month, 0));

  const where: Prisma.LeaveRequestWhereInput = {
    isDeleted: false,
    status: { in: ['APPROVED', 'PENDING'] },
    fromDate: { lte: monthEnd },
    toDate: { gte: monthStart },
  };
  if (query.departmentId) where.employee = { departmentId: query.departmentId };
  if (query.leaveTypeId) where.leaveTypeId = query.leaveTypeId;
  if (query.employeeId) where.employeeId = query.employeeId;

  const rows = await prisma.leaveRequest.findMany({
    where,
    orderBy: { fromDate: 'asc' },
    take: 500,
    select: {
      id: true,
      fromDate: true,
      toDate: true,
      status: true,
      employee: { select: { fullName: true } },
      leaveType: { select: { name: true } },
    },
  });

  return rows.map((r) => ({
    id: r.id,
    employeeName: r.employee.fullName,
    leaveTypeName: r.leaveType.name,
    fromDate: r.fromDate.toISOString(),
    toDate: r.toDate.toISOString(),
    status: r.status,
  }));
}

/** Dashboard widgets (§275) — all counts issued in parallel. */
export async function getLeaveDashboard() {
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthEnd = new Date(now.getFullYear(), now.getMonth() + 1, 0);
  const todayStart = new Date(Date.UTC(now.getFullYear(), now.getMonth(), now.getDate()));

  const [pending, approvedThisMonth, rejectedThisMonth, onLeaveToday, upcoming] = await Promise.all([
    prisma.leaveRequest.count({ where: { isDeleted: false, status: 'PENDING' } }),
    prisma.leaveRequest.count({
      where: {
        isDeleted: false,
        status: 'APPROVED',
        approvalDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        isDeleted: false,
        status: 'REJECTED',
        approvalDate: { gte: monthStart, lte: monthEnd },
      },
    }),
    prisma.leaveRequest.count({
      where: {
        isDeleted: false,
        status: 'APPROVED',
        fromDate: { lte: todayStart },
        toDate: { gte: todayStart },
      },
    }),
    prisma.leaveRequest.findMany({
      where: { isDeleted: false, status: 'APPROVED', fromDate: { gt: todayStart } },
      orderBy: { fromDate: 'asc' },
      take: 5,
      select: {
        id: true,
        leaveNumber: true,
        fromDate: true,
        toDate: true,
        employee: { select: { fullName: true } },
        leaveType: { select: { name: true } },
      },
    }),
  ]);

  return {
    pending,
    approvedThisMonth,
    rejectedThisMonth,
    onLeaveToday,
    upcoming: upcoming.map((u) => ({
      id: u.id,
      leaveNumber: u.leaveNumber,
      employeeName: u.employee.fullName,
      leaveTypeName: u.leaveType.name,
      fromDate: u.fromDate.toISOString(),
      toDate: u.toDate.toISOString(),
    })),
  };
}

/** Direct reports' leave for managers (§283). */
export async function getTeamLeave(user: AuthUser, query: LeaveListQuery) {
  const reports = await prisma.user.findMany({
    where: { reportingManagerId: user.id, isDeleted: false },
    select: { id: true },
  });
  const reportIds = reports.map((r) => r.id);

  // A manager with no direct reports sees an empty team view rather than
  // everyone's leave.
  if (reportIds.length === 0) {
    return { rows: [] as LeaveRow[], meta: buildPaginationMeta(query, 0) };
  }

  const where: Prisma.LeaveRequestWhereInput = {
    isDeleted: false,
    employeeId: { in: reportIds },
    ...(query.status ? { status: query.status } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.leaveRequest.findMany({
      where,
      orderBy: { fromDate: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        leaveNumber: true,
        employeeId: true,
        fromDate: true,
        toDate: true,
        totalDays: true,
        isHalfDay: true,
        status: true,
        createdAt: true,
        approvedBy: true,
        employee: { select: { fullName: true } },
        leaveType: { select: { name: true } },
      },
    }),
    prisma.leaveRequest.count({ where }),
  ]);

  const nameById = await approverNames(items.map((l) => l.approvedBy));
  const rows: LeaveRow[] = items.map((l) => ({
    id: l.id,
    leaveNumber: l.leaveNumber,
    employeeId: l.employeeId,
    employeeName: l.employee.fullName,
    leaveTypeName: l.leaveType.name,
    fromDate: l.fromDate.toISOString(),
    toDate: l.toDate.toISOString(),
    totalDays: l.totalDays.toNumber(),
    isHalfDay: l.isHalfDay,
    status: l.status,
    appliedDate: l.createdAt.toISOString(),
    approverName: l.approvedBy ? (nameById.get(l.approvedBy) ?? null) : null,
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

/** Active leave types for the apply form. */
export function getLeaveTypeOptions() {
  return prisma.leaveType.findMany({
    where: { isDeleted: false, isActive: true },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, isPaid: true, requiresDocument: true },
  });
}
