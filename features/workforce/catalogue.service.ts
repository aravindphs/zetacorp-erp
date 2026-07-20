import 'server-only';

/**
 * Department & designation business logic (spec §252, §253). Soft delete only;
 * a department or designation still assigned to employees cannot be deleted
 * (§264 "Department deletion blocked if employees exist").
 */
import { prisma } from '@/lib/prisma';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';
import type { DepartmentInput, DesignationInput } from '@/features/workforce/catalogue.schema';

export interface DepartmentRow {
  id: string;
  name: string;
  description: string | null;
  managerId: string | null;
  managerName: string | null;
  isActive: boolean;
  employeeCount: number;
}

export interface DesignationRow {
  id: string;
  name: string;
  description: string | null;
  isActive: boolean;
  employeeCount: number;
}

// --- Departments ----------------------------------------------------------

export async function listDepartments(includeInactive = true): Promise<DepartmentRow[]> {
  const rows = await prisma.department.findMany({
    where: { isDeleted: false, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      managerId: true,
      isActive: true,
      manager: { select: { fullName: true } },
      _count: { select: { employees: { where: { isDeleted: false } } } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    managerId: d.managerId,
    managerName: d.manager?.fullName ?? null,
    isActive: d.isActive,
    employeeCount: d._count.employees,
  }));
}

async function assertUniqueDepartment(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.department.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError('A department with this name already exists.');
}

export async function createDepartment(user: AuthUser, input: DepartmentInput) {
  await assertUniqueDepartment(input.name);
  const department = await prisma.department.create({
    data: { ...input, ...auditCreate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Created department ${department.name}`,
    module: 'department',
    referenceId: department.id,
  });
  return department;
}

export async function updateDepartment(user: AuthUser, id: string, input: DepartmentInput) {
  const existing = await prisma.department.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Department not found.');
  await assertUniqueDepartment(input.name, id);
  const department = await prisma.department.update({
    where: { id },
    data: { ...input, managerId: input.managerId ?? null, ...auditUpdate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Updated department ${department.name}`,
    module: 'department',
    referenceId: id,
  });
  return department;
}

export async function deleteDepartment(user: AuthUser, id: string) {
  const existing = await prisma.department.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Department not found.');

  const employeeCount = await prisma.user.count({ where: { departmentId: id, isDeleted: false } });
  if (employeeCount > 0) {
    throw new BusinessRuleError('This department has employees and cannot be deleted.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.department.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit(
      { userId: user.id, action: 'DELETE', module: 'department', referenceId: id, oldValue: { name: existing.name } },
      tx,
    );
  });
  await logActivity({
    userId: user.id,
    activity: `Deleted department ${existing.name}`,
    module: 'department',
    referenceId: id,
  });
}

// --- Designations ---------------------------------------------------------

export async function listDesignations(includeInactive = true): Promise<DesignationRow[]> {
  const rows = await prisma.designation.findMany({
    where: { isDeleted: false, ...(includeInactive ? {} : { isActive: true }) },
    orderBy: { name: 'asc' },
    select: {
      id: true,
      name: true,
      description: true,
      isActive: true,
      _count: { select: { employees: { where: { isDeleted: false } } } },
    },
  });
  return rows.map((d) => ({
    id: d.id,
    name: d.name,
    description: d.description,
    isActive: d.isActive,
    employeeCount: d._count.employees,
  }));
}

async function assertUniqueDesignation(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.designation.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError('A designation with this name already exists.');
}

export async function createDesignation(user: AuthUser, input: DesignationInput) {
  await assertUniqueDesignation(input.name);
  const designation = await prisma.designation.create({
    data: { ...input, ...auditCreate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Created designation ${designation.name}`,
    module: 'designation',
    referenceId: designation.id,
  });
  return designation;
}

export async function updateDesignation(user: AuthUser, id: string, input: DesignationInput) {
  const existing = await prisma.designation.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Designation not found.');
  await assertUniqueDesignation(input.name, id);
  const designation = await prisma.designation.update({
    where: { id },
    data: { ...input, ...auditUpdate(user.id) },
  });
  await logActivity({
    userId: user.id,
    activity: `Updated designation ${designation.name}`,
    module: 'designation',
    referenceId: id,
  });
  return designation;
}

export async function deleteDesignation(user: AuthUser, id: string) {
  const existing = await prisma.designation.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Designation not found.');

  const employeeCount = await prisma.user.count({ where: { designationId: id, isDeleted: false } });
  if (employeeCount > 0) {
    throw new BusinessRuleError('This designation is assigned to employees and cannot be deleted.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.designation.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit(
      { userId: user.id, action: 'DELETE', module: 'designation', referenceId: id, oldValue: { name: existing.name } },
      tx,
    );
  });
  await logActivity({
    userId: user.id,
    activity: `Deleted designation ${existing.name}`,
    module: 'designation',
    referenceId: id,
  });
}
