'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { uuidSchema } from '@/schemas/common';
import {
  backupSchema,
  companyProfileSchema,
  financialConfigSchema,
  gstSettingsSchema,
  numberSequenceSchema,
  preferencesSchema,
  roleSchema,
  rolePermissionsSchema,
  securitySettingsSchema,
} from '@/features/admin/admin.schema';
import {
  createBackup,
  createRole,
  deleteRole,
  setRolePermissions,
  updateCompanyProfile,
  updateFinancialConfig,
  updateGstSettings,
  updateNumberSequence,
  updatePreferences,
  updateRole,
  updateSecuritySettings,
} from '@/features/admin/admin.service';

const SETTINGS_PATH = '/admin/settings';
const ROLES_PATH = '/admin/roles';

export async function updateCompanyProfileAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updateCompanyProfile(user, companyProfileSchema.parse(input));
    revalidatePath(SETTINGS_PATH);
    return actionOk(null, 'Company profile saved.');
  });
}

export async function updateFinancialConfigAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updateFinancialConfig(user, financialConfigSchema.parse(input));
    revalidatePath(SETTINGS_PATH);
    return actionOk(null, 'Financial settings saved.');
  });
}

export async function updateGstSettingsAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updateGstSettings(user, gstSettingsSchema.parse(input));
    revalidatePath(SETTINGS_PATH);
    return actionOk(null, 'GST settings saved.');
  });
}

export async function updateSecuritySettingsAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updateSecuritySettings(user, securitySettingsSchema.parse(input));
    revalidatePath(SETTINGS_PATH);
    return actionOk(null, 'Security settings saved.');
  });
}

export async function updatePreferencesAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updatePreferences(user, preferencesSchema.parse(input));
    revalidatePath(SETTINGS_PATH);
    return actionOk(null, 'Preferences saved.');
  });
}

// --- Roles -----------------------------------------------------------------

export async function createRoleAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('role.manage');
    const role = await createRole(user, roleSchema.parse(input));
    revalidatePath(ROLES_PATH);
    return actionOk({ id: role.id }, 'Role created.');
  });
}

export async function updateRoleAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('role.manage');
    const role = await updateRole(user, uuidSchema.parse(id), roleSchema.parse(input));
    revalidatePath(ROLES_PATH);
    return actionOk({ id: role.id }, 'Role updated.');
  });
}

export async function deleteRoleAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('role.manage');
    await deleteRole(user, uuidSchema.parse(id));
    revalidatePath(ROLES_PATH);
    return actionOk(null, 'Role deleted.');
  });
}

export async function setRolePermissionsAction(
  roleId: string,
  input: unknown,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('role.manage');
    const { permissionIds } = rolePermissionsSchema.parse(input);
    await setRolePermissions(user, uuidSchema.parse(roleId), permissionIds);
    revalidatePath(ROLES_PATH);
    return actionOk(null, 'Permissions updated. They apply immediately.');
  });
}

// --- Numbering & backups ---------------------------------------------------

export async function updateNumberSequenceAction(input: unknown): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('settings.manage');
    await updateNumberSequence(user, numberSequenceSchema.parse(input));
    revalidatePath('/admin/numbering');
    return actionOk(null, 'Numbering updated. It applies to new records only.');
  });
}

export async function createBackupAction(input: unknown): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('backup.create');
    const { backupName } = backupSchema.parse(input);
    const backup = await createBackup(user, backupName);
    revalidatePath('/admin/backups');
    return actionOk({ id: backup.id }, 'Backup recorded.');
  });
}
