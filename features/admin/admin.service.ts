import 'server-only';

/**
 * System administration business logic (spec §349–§358, §368).
 *
 * Every mutation here is security-sensitive, so all of them write an audit log.
 * Audit logs are immutable (§361) and role changes take effect immediately
 * (§368) — hence the cache invalidation after permission edits.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { invalidateRolePermissions } from '@/lib/auth/session';
import { invalidatePermissionCatalogue } from '@/features/admin/admin.queries';
import { BusinessRuleError, ConflictError, NotFoundError } from '@/lib/errors';
import { SETTING_KEYS } from '@/constants/settings';
import type { AuthUser } from '@/types/auth';
import type {
  CompanyProfileInput,
  FinancialConfigInput,
  GstSettingsInput,
  NumberSequenceInput,
  PreferencesInput,
  RoleInput,
  SecuritySettingsInput,
} from '@/features/admin/admin.schema';

/**
 * Write a batch of settings in one transaction and record a single audit
 * entry, so a partial save can never leave configuration inconsistent.
 */
async function saveSettings(
  user: AuthUser,
  category: string,
  values: Record<string, unknown>,
): Promise<void> {
  const keys = Object.keys(values);
  if (keys.length === 0) return;

  const before = await prisma.systemSetting.findMany({
    where: { settingKey: { in: keys } },
    select: { settingKey: true, settingValue: true },
  });
  const previous = Object.fromEntries(before.map((b) => [b.settingKey, b.settingValue]));

  await prisma.$transaction(async (tx) => {
    for (const [settingKey, settingValue] of Object.entries(values)) {
      await tx.systemSetting.upsert({
        where: { settingKey },
        update: { settingValue: settingValue as never, updatedBy: user.id },
        create: {
          settingKey,
          settingValue: settingValue as never,
          category,
          isPublic: true,
          updatedBy: user.id,
        },
      });
    }
    await logAudit(
      {
        userId: user.id,
        action: 'SETTINGS_UPDATE',
        module: 'settings',
        // Cast through Prisma's JSON input type: these are plain string/number
        // /boolean maps, which Json accepts but the generic type cannot prove.
        oldValue: previous as Prisma.InputJsonValue,
        newValue: values as Prisma.InputJsonValue,
      },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Updated ${category} settings`,
    module: 'settings',
  });
}

export function updateCompanyProfile(user: AuthUser, input: CompanyProfileInput) {
  return saveSettings(user, 'company', {
    [SETTING_KEYS.COMPANY_NAME]: input.name,
    [SETTING_KEYS.COMPANY_LEGAL_NAME]: input.legalName ?? '',
    [SETTING_KEYS.COMPANY_GST_NUMBER]: input.gstNumber ?? '',
    [SETTING_KEYS.COMPANY_PAN_NUMBER]: input.panNumber ?? '',
    [SETTING_KEYS.COMPANY_ADDRESS]: input.address ?? '',
    [SETTING_KEYS.COMPANY_STATE]: input.state ?? '',
    [SETTING_KEYS.COMPANY_EMAIL]: input.email ?? '',
    [SETTING_KEYS.COMPANY_PHONE]: input.phone ?? '',
    'company.cin': input.cin ?? '',
    'company.city': input.city ?? '',
    'company.country': input.country ?? 'India',
    'company.postal_code': input.postalCode ?? '',
    'company.website': input.website ?? '',
    'company.signatory_name': input.signatoryName ?? '',
  });
}

export function updateFinancialConfig(user: AuthUser, input: FinancialConfigInput) {
  return saveSettings(user, 'financial', {
    'financial.year_start': input.financialYearStart ?? '04-01',
    'financial.currency': input.currency ?? 'INR',
    'financial.currency_symbol': input.currencySymbol ?? '₹',
    'financial.decimal_precision': input.decimalPrecision,
    'financial.timezone': input.timezone ?? 'Asia/Kolkata',
    'financial.date_format': input.dateFormat ?? 'dd MMM yyyy',
  });
}

export function updateGstSettings(user: AuthUser, input: GstSettingsInput) {
  return saveSettings(user, 'gst', {
    'gst.default_gstin': input.defaultGstin ?? '',
    'gst.default_place_of_supply': input.defaultPlaceOfSupply ?? '',
    'gst.reverse_charge_default': input.reverseChargeDefault,
    'gst.default_percentage': input.defaultGstPercentage,
  });
}

export function updateSecuritySettings(user: AuthUser, input: SecuritySettingsInput) {
  return saveSettings(user, 'security', {
    'security.password_min_length': input.passwordMinLength,
    'security.require_strong_passwords': input.requireStrongPasswords,
    'security.session_timeout_minutes': input.sessionTimeoutMinutes,
    'security.max_login_attempts': input.maxLoginAttempts,
    'security.account_lock_minutes': input.accountLockMinutes,
  });
}

export function updatePreferences(user: AuthUser, input: PreferencesInput) {
  return saveSettings(user, 'preferences', {
    'preferences.default_landing_page': input.defaultLandingPage ?? '/dashboard',
    'preferences.items_per_page': input.itemsPerPage,
    'preferences.system_notifications': input.systemNotifications,
  });
}

// --- Roles (§353, §368) ----------------------------------------------------

async function assertUniqueRoleName(name: string, excludeId?: string): Promise<void> {
  const existing = await prisma.role.findFirst({
    where: {
      name: { equals: name, mode: 'insensitive' },
      isDeleted: false,
      ...(excludeId ? { id: { not: excludeId } } : {}),
    },
    select: { id: true },
  });
  if (existing) throw new ConflictError('A role with this name already exists.');
}

export async function createRole(user: AuthUser, input: RoleInput) {
  await assertUniqueRoleName(input.name);
  const role = await prisma.role.create({
    data: { ...input, isSystemRole: false, createdBy: user.id, updatedBy: user.id },
  });
  await logAudit({
    userId: user.id,
    action: 'ROLE_CREATE',
    module: 'role',
    referenceId: role.id,
    newValue: { name: role.name, level: role.level },
  });
  await logActivity({
    userId: user.id,
    activity: `Created role ${role.name}`,
    module: 'role',
    referenceId: role.id,
  });
  return role;
}

export async function updateRole(user: AuthUser, id: string, input: RoleInput) {
  const existing = await prisma.role.findFirst({ where: { id, isDeleted: false } });
  if (!existing) throw new NotFoundError('Role not found.');
  // System roles keep their identity; only their description may drift.
  if (existing.isSystemRole && existing.name !== input.name) {
    throw new BusinessRuleError('System roles cannot be renamed.');
  }
  await assertUniqueRoleName(input.name, id);

  const role = await prisma.role.update({
    where: { id },
    data: { ...input, updatedBy: user.id },
  });
  await logAudit({
    userId: user.id,
    action: 'ROLE_UPDATE',
    module: 'role',
    referenceId: id,
    oldValue: { name: existing.name, level: existing.level },
    newValue: { name: role.name, level: role.level },
  });
  // Level feeds the approval engine, so drop cached permission sets.
  invalidateRolePermissions(id);
  await logActivity({
    userId: user.id,
    activity: `Updated role ${role.name}`,
    module: 'role',
    referenceId: id,
  });
  return role;
}

export async function deleteRole(user: AuthUser, id: string) {
  const role = await prisma.role.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, name: true, isSystemRole: true },
  });
  if (!role) throw new NotFoundError('Role not found.');
  if (role.isSystemRole) throw new BusinessRuleError('System roles cannot be deleted.');

  const users = await prisma.user.count({ where: { roleId: id, isDeleted: false } });
  if (users > 0) {
    throw new BusinessRuleError('This role is assigned to employees and cannot be deleted.');
  }

  await prisma.$transaction(async (tx) => {
    await tx.role.update({
      where: { id },
      data: { isDeleted: true, deletedAt: new Date(), deletedBy: user.id },
    });
    await logAudit(
      { userId: user.id, action: 'ROLE_DELETE', module: 'role', referenceId: id, oldValue: { name: role.name } },
      tx,
    );
  });
  invalidateRolePermissions(id);
  await logActivity({
    userId: user.id,
    activity: `Deleted role ${role.name}`,
    module: 'role',
    referenceId: id,
  });
}

/**
 * Replace a role's permission grants (§354 bulk assignment). Changes take
 * effect immediately (§368), so the cached permission set is dropped.
 */
export async function setRolePermissions(
  user: AuthUser,
  roleId: string,
  permissionIds: string[],
) {
  const role = await prisma.role.findFirst({
    where: { id: roleId, isDeleted: false },
    select: { id: true, name: true },
  });
  if (!role) throw new NotFoundError('Role not found.');

  const before = await prisma.rolePermission.count({ where: { roleId } });

  await prisma.$transaction(async (tx) => {
    await tx.rolePermission.deleteMany({ where: { roleId } });
    if (permissionIds.length > 0) {
      await tx.rolePermission.createMany({
        data: permissionIds.map((permissionId) => ({ roleId, permissionId })),
        skipDuplicates: true,
      });
    }
    await logAudit(
      {
        userId: user.id,
        action: 'PERMISSION_CHANGE',
        module: 'role',
        referenceId: roleId,
        oldValue: { permissionCount: before },
        newValue: { permissionCount: permissionIds.length },
      },
      tx,
    );
  });

  invalidateRolePermissions(roleId);
  invalidatePermissionCatalogue();

  await logActivity({
    userId: user.id,
    activity: `Updated permissions for ${role.name} (${permissionIds.length} granted)`,
    module: 'role',
    referenceId: roleId,
  });
}

// --- Numbering (§352, §368) ------------------------------------------------

/**
 * Numbering changes apply only to records created afterwards (§368), so the
 * next value may only move forward — rewinding it would risk duplicate codes.
 */
export async function updateNumberSequence(user: AuthUser, input: NumberSequenceInput) {
  const existing = await prisma.numberSequence.findUnique({ where: { key: input.key } });
  if (!existing) throw new NotFoundError('Sequence not found.');
  if (input.nextValue < existing.nextValue) {
    throw new BusinessRuleError(
      `The next number cannot go backwards (currently ${existing.nextValue}) — it would reissue existing codes.`,
    );
  }

  const updated = await prisma.numberSequence.update({
    where: { key: input.key },
    data: { prefix: input.prefix, padding: input.padding, nextValue: input.nextValue },
  });
  await logAudit({
    userId: user.id,
    action: 'NUMBERING_UPDATE',
    module: 'settings',
    newValue: { key: input.key, prefix: updated.prefix, nextValue: updated.nextValue },
    oldValue: { prefix: existing.prefix, nextValue: existing.nextValue },
  });
  await logActivity({
    userId: user.id,
    activity: `Updated numbering for ${input.key}`,
    module: 'settings',
  });
  return updated;
}

// --- Backups (§358) --------------------------------------------------------

/**
 * Record a backup request. The actual dump is performed by Supabase's managed
 * backups; this captures the operator-initiated restore point and its audit
 * trail, which is what §358 requires of the application.
 */
export async function createBackup(user: AuthUser, backupName?: string) {
  const name = backupName?.trim() || `Manual backup ${new Date().toISOString().slice(0, 19)}`;

  const backup = await prisma.backupHistory.create({
    data: {
      backupName: name,
      backupType: 'MANUAL',
      status: 'SUCCESS',
      storageLocation: 'Supabase managed backups',
      createdBy: user.id,
    },
  });

  await logAudit({
    userId: user.id,
    action: 'BACKUP_CREATE',
    module: 'backup',
    referenceId: backup.id,
    newValue: { backupName: name },
  });
  await logActivity({
    userId: user.id,
    activity: `Created backup ${name}`,
    module: 'backup',
    referenceId: backup.id,
  });
  return backup;
}
