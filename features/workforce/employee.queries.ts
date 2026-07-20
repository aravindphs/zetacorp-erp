import 'server-only';

/**
 * Employee read models (spec §248, §249, §257). Employees are `users` rows —
 * the app profile paired with a Supabase Auth account.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { EmployeeListQuery } from '@/features/workforce/employee.schema';
import type { EmployeeOption, EmployeeRow } from '@/features/workforce/employee.types';

const SORTABLE = new Set(['employeeCode', 'fullName', 'joiningDate', 'createdAt']);

function buildWhere(query: EmployeeListQuery): Prisma.UserWhereInput {
  const where: Prisma.UserWhereInput = { isDeleted: false };
  if (query.status) where.status = query.status;
  if (query.departmentId) where.departmentId = query.departmentId;
  if (query.designationId) where.designationId = query.designationId;
  if (query.roleId) where.roleId = query.roleId;
  if (query.joinedFrom || query.joinedTo) {
    where.joiningDate = {};
    if (query.joinedFrom) where.joiningDate.gte = new Date(query.joinedFrom);
    if (query.joinedTo) where.joiningDate.lte = new Date(query.joinedTo);
  }
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [
      { employeeCode: contains },
      { fullName: contains },
      { email: contains },
      { phone: contains },
    ];
  }
  return where;
}

export async function getEmployeeList(query: EmployeeListQuery) {
  const where = buildWhere(query);
  const orderField = query.sortBy && SORTABLE.has(query.sortBy) ? query.sortBy : 'employeeCode';

  const [items, total] = await Promise.all([
    prisma.user.findMany({
      where,
      orderBy: { [orderField]: query.sortOrder },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        employeeCode: true,
        fullName: true,
        email: true,
        phone: true,
        profilePhoto: true,
        joiningDate: true,
        status: true,
        department: { select: { name: true } },
        designation: { select: { name: true } },
        role: { select: { name: true } },
      },
    }),
    prisma.user.count({ where }),
  ]);

  const rows: EmployeeRow[] = items.map((u) => ({
    id: u.id,
    employeeCode: u.employeeCode,
    fullName: u.fullName,
    email: u.email,
    phone: u.phone,
    profilePhoto: u.profilePhoto,
    departmentName: u.department?.name ?? null,
    designationName: u.designation?.name ?? null,
    roleName: u.role.name,
    joiningDate: u.joiningDate?.toISOString() ?? null,
    status: u.status,
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

/** Full profile for the employee detail page (§249). */
export function getEmployeeDetail(id: string) {
  return prisma.user.findFirst({
    where: { id, isDeleted: false },
    include: {
      role: { select: { id: true, name: true } },
      department: { select: { id: true, name: true } },
      designation: { select: { id: true, name: true } },
      reportingManager: { select: { id: true, fullName: true, employeeCode: true } },
      documents: {
        where: { isDeleted: false },
        orderBy: { createdAt: 'desc' },
      },
    },
  });
}

/** Active employees for manager / reporting-manager pickers. */
export async function getEmployeeOptions(search = ''): Promise<EmployeeOption[]> {
  const where: Prisma.UserWhereInput = { isDeleted: false, status: 'ACTIVE' };
  const term = search.trim();
  if (term) {
    const contains = { contains: term, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ fullName: contains }, { employeeCode: contains }, { email: contains }];
  }
  const users = await prisma.user.findMany({
    where,
    orderBy: { fullName: 'asc' },
    take: 100,
    select: { id: true, fullName: true, employeeCode: true },
  });
  return users;
}

/** Role options for assignment dropdowns (§254). */
export function getRoleOptions() {
  return prisma.role.findMany({
    where: { isDeleted: false },
    orderBy: { name: 'asc' },
    select: { id: true, name: true, description: true },
  });
}

/** Latest activity for the employee Activity tab — capped at 100 (§256). */
export function getEmployeeActivity(employeeId: string) {
  return prisma.activityLog.findMany({
    where: { userId: employeeId },
    orderBy: { createdAt: 'desc' },
    take: 100,
    select: { id: true, activity: true, module: true, createdAt: true },
  });
}
