import 'server-only';

/**
 * Employee & user-account business logic (spec §246, §254, §258, §262, §264).
 *
 * An employee is a `users` row paired with a Supabase Auth account, and the two
 * share a primary key (`users.id` == auth uid) so RLS `auth.uid()` resolves.
 * Because the Auth account lives outside Postgres it cannot join the database
 * transaction — the account is created first and removed again if the profile
 * insert fails, so the two stores never drift.
 *
 * Employees are never hard deleted (§264); termination sets TERMINATED.
 */
import { prisma } from '@/lib/prisma';
import { createSupabaseAdminClient } from '@/lib/supabase/admin';
import { generateCode } from '@/lib/code-generator';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { invalidateUserProfile } from '@/lib/auth/session';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import { CODE_PREFIX } from '@/constants/app';
import type { AuthUser } from '@/types/auth';
import type {
  ChangeStatusInput,
  CreateEmployeeInput,
  UpdateEmployeeInput,
} from '@/features/workforce/employee.schema';

/** Compose the canonical display name from the §250 first/last fields. */
function composeFullName(firstName: string, lastName?: string): string {
  return [firstName.trim(), lastName?.trim()].filter(Boolean).join(' ');
}

function toDate(value?: string): Date | null {
  return value ? new Date(value) : null;
}

/** Email and phone must be unique across employees (§262). */
async function assertUniqueContact(
  email: string,
  phone: string | undefined,
  excludeId?: string,
): Promise<void> {
  const not = excludeId ? { id: { not: excludeId } } : {};
  const emailClash = await prisma.user.findFirst({
    where: { email: email.toLowerCase(), isDeleted: false, ...not },
    select: { id: true },
  });
  if (emailClash) throw new ConflictError('An employee with this email already exists.');

  if (phone) {
    const phoneClash = await prisma.user.findFirst({
      where: { phone, isDeleted: false, ...not },
      select: { id: true },
    });
    if (phoneClash) throw new ConflictError('An employee with this phone number already exists.');
  }
}

/** Shared profile column mapping for create/update. */
function profileData(input: UpdateEmployeeInput) {
  return {
    firstName: input.firstName,
    lastName: input.lastName,
    fullName: composeFullName(input.firstName, input.lastName),
    email: input.email.toLowerCase(),
    phone: input.phone ?? null,
    alternatePhone: input.alternatePhone ?? null,
    gender: input.gender ?? null,
    dateOfBirth: toDate(input.dateOfBirth),
    bloodGroup: input.bloodGroup ?? null,
    nationality: input.nationality ?? null,
    maritalStatus: input.maritalStatus ?? null,
    emergencyContactName: input.emergencyContactName ?? null,
    emergencyContactPhone: input.emergencyContactPhone ?? null,
    addressLine1: input.addressLine1 ?? null,
    addressLine2: input.addressLine2 ?? null,
    city: input.city ?? null,
    state: input.state ?? null,
    postalCode: input.postalCode ?? null,
    departmentId: input.departmentId,
    designationId: input.designationId ?? null,
    roleId: input.roleId,
    joiningDate: toDate(input.joiningDate),
    reportingManagerId: input.reportingManagerId ?? null,
    employmentType: input.employmentType ?? null,
    probationEndDate: toDate(input.probationEndDate),
    workLocation: input.workLocation ?? null,
    status: input.status,
  };
}

export async function createEmployee(user: AuthUser, input: CreateEmployeeInput) {
  await assertUniqueContact(input.email, input.phone);

  const supabase = createSupabaseAdminClient();
  const fullName = composeFullName(input.firstName, input.lastName);

  // 1. Create the Auth account — this yields the shared primary key.
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: input.email.toLowerCase(),
    password: input.password,
    email_confirm: true,
    user_metadata: { full_name: fullName },
  });
  if (authError || !authData.user) {
    throw new BusinessRuleError(authError?.message ?? 'Could not create the login account.');
  }
  const authUserId = authData.user.id;

  // 2. Create the profile. If this fails, undo the Auth account so a retry with
  //    the same email is not blocked by an orphaned login.
  try {
    const employee = await prisma.$transaction(async (tx) => {
      const employeeCode = await generateCode(tx, {
        key: 'employee',
        prefix: CODE_PREFIX.EMPLOYEE,
      });

      const created = await tx.user.create({
        data: {
          id: authUserId,
          employeeCode,
          passwordManagedBySupabase: true,
          lastPasswordChangeAt: new Date(),
          ...profileData(input),
          ...auditCreate(user.id),
        },
      });

      await logAudit(
        {
          userId: user.id,
          action: 'CREATE',
          module: 'employee',
          referenceId: created.id,
          newValue: { employeeCode, email: created.email, roleId: created.roleId },
        },
        tx,
      );
      return created;
    });

    await logActivity({
      userId: user.id,
      activity: `Created employee ${employee.employeeCode} (${employee.fullName})`,
      module: 'employee',
      referenceId: employee.id,
    });
    return employee;
  } catch (error) {
    await supabase.auth.admin.deleteUser(authUserId).catch(() => undefined);
    throw error;
  }
}

export async function updateEmployee(user: AuthUser, id: string, input: UpdateEmployeeInput) {
  const existing = await prisma.user.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Employee not found.');

  // Reporting manager cannot reference the employee themselves (§262).
  if (input.reportingManagerId && input.reportingManagerId === id) {
    throw new BusinessRuleError('An employee cannot report to themselves.');
  }
  await assertUniqueContact(input.email, input.phone, id);

  const emailChanged = existing.email.toLowerCase() !== input.email.toLowerCase();

  const employee = await prisma.$transaction(async (tx) => {
    const updated = await tx.user.update({
      where: { id },
      data: { ...profileData(input), ...auditUpdate(user.id) },
    });
    await logAudit(
      {
        userId: user.id,
        action: 'UPDATE',
        module: 'employee',
        referenceId: id,
        oldValue: { email: existing.email, roleId: existing.roleId, status: existing.status },
        newValue: { email: updated.email, roleId: updated.roleId, status: updated.status },
      },
      tx,
    );
    return updated;
  });

  // Keep the Auth login address in sync with the profile.
  if (emailChanged) {
    const supabase = createSupabaseAdminClient();
    const { error } = await supabase.auth.admin.updateUserById(id, {
      email: input.email.toLowerCase(),
      email_confirm: true,
    });
    if (error) throw new BusinessRuleError(`Profile saved, but the login email failed: ${error.message}`);
  }

  // Bust the cached profile so role/status edits take effect immediately (§264).
  invalidateUserProfile(id);

  await logActivity({
    userId: user.id,
    activity: `Updated employee ${employee.employeeCode}`,
    module: 'employee',
    referenceId: id,
  });
  return employee;
}

/** Admin password reset (§258, §259). */
export async function resetEmployeePassword(user: AuthUser, id: string, password: string) {
  const employee = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeCode: true, fullName: true },
  });
  if (!employee) throw new NotFoundError('Employee not found.');

  const supabase = createSupabaseAdminClient();
  const { error } = await supabase.auth.admin.updateUserById(id, { password });
  if (error) throw new BusinessRuleError(error.message);

  await prisma.user.update({
    where: { id },
    data: { lastPasswordChangeAt: new Date(), ...auditUpdate(user.id) },
  });
  await logAudit({
    userId: user.id,
    action: 'PASSWORD_RESET',
    module: 'employee',
    referenceId: id,
    newValue: { employeeCode: employee.employeeCode },
  });
  await logActivity({
    userId: user.id,
    activity: `Reset password for ${employee.employeeCode}`,
    module: 'employee',
    referenceId: id,
  });
}

/** Change an employee's role (§258); permissions refresh immediately (§264). */
export async function changeEmployeeRole(user: AuthUser, id: string, roleId: string) {
  const employee = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeCode: true, roleId: true },
  });
  if (!employee) throw new NotFoundError('Employee not found.');

  const role = await prisma.role.findFirst({ where: { id: roleId, isDeleted: false } });
  if (!role) throw new NotFoundError('Role not found.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { roleId, ...auditUpdate(user.id) } });
    await logAudit(
      {
        userId: user.id,
        action: 'ROLE_CHANGE',
        module: 'employee',
        referenceId: id,
        oldValue: { roleId: employee.roleId },
        newValue: { roleId },
      },
      tx,
    );
  });

  invalidateUserProfile(id);
  await logActivity({
    userId: user.id,
    activity: `Changed role for ${employee.employeeCode} to ${role.name}`,
    module: 'employee',
    referenceId: id,
  });
}

/**
 * Activate / deactivate / suspend / terminate (§258, §264). Only ACTIVE users
 * can sign in (§247), so this is the access switch — employees are never hard
 * deleted.
 */
export async function changeEmployeeStatus(user: AuthUser, id: string, input: ChangeStatusInput) {
  const employee = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeCode: true, status: true },
  });
  if (!employee) throw new NotFoundError('Employee not found.');

  if (id === user.id && input.status !== 'ACTIVE') {
    throw new BusinessRuleError('You cannot deactivate your own account.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { status: input.status, ...auditUpdate(user.id) },
    });
    await logAudit(
      {
        userId: user.id,
        action: 'STATUS_CHANGE',
        module: 'employee',
        referenceId: id,
        oldValue: { status: employee.status },
        newValue: { status: input.status, reason: input.reason },
      },
      tx,
    );
  });

  // Drop the cached profile so a deactivated user loses access on the next request.
  invalidateUserProfile(id);
  await logActivity({
    userId: user.id,
    activity: `Set ${employee.employeeCode} status to ${input.status}`,
    module: 'employee',
    referenceId: id,
  });
}

/** Soft delete (§264 — never hard deleted, and the login is disabled). */
export async function deleteEmployee(user: AuthUser, id: string, reason: string) {
  const employee = await prisma.user.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, employeeCode: true, fullName: true },
  });
  if (!employee) throw new NotFoundError('Employee not found.');
  if (id === user.id) throw new BusinessRuleError('You cannot delete your own account.');

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { status: 'TERMINATED', ...softDelete(user.id) },
    });
    await logAudit(
      {
        userId: user.id,
        action: 'DELETE',
        module: 'employee',
        referenceId: id,
        oldValue: { employeeCode: employee.employeeCode, reason },
      },
      tx,
    );
  });

  invalidateUserProfile(id);
  await logActivity({
    userId: user.id,
    activity: `Removed employee ${employee.employeeCode}`,
    module: 'employee',
    referenceId: id,
  });
}
