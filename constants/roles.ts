/**
 * System roles and their default permission grants (spec §4, §22, §58).
 *
 * These are the *seeded defaults*. Because permission checks are data-driven
 * (spec §53), an Admin can later customise any non-system role without code
 * changes. The three roles below are flagged `is_system_role` and cannot be
 * deleted.
 *
 * Row-level ownership (spec §57–58) further restricts which records a user sees
 * even when they hold the module permission (e.g. Staff hold `expense.view`
 * but only ever see their own expenses).
 */
import { ALL_PERMISSION_KEYS, type PermissionKey } from '@/constants/permissions';

export const ROLE_NAMES = {
  ADMIN: 'Admin',
  MANAGER: 'Manager',
  STAFF: 'Staff',
} as const;

export type RoleName = (typeof ROLE_NAMES)[keyof typeof ROLE_NAMES];

export interface RoleDefinition {
  name: RoleName;
  description: string;
  isSystemRole: true;
  /**
   * Authority rank consumed by the approval engine (spec §284): an approver
   * must outrank the requester. Admin approves Manager leave; Manager and Admin
   * both approve Staff leave. Expressed as data so approval rules stay
   * configurable instead of hardcoding role names.
   */
  level: number;
  /** `'ALL'` grants every permission (Admin); otherwise an explicit list. */
  permissions: 'ALL' | readonly PermissionKey[];
}

export const ROLE_LEVELS = { ADMIN: 100, MANAGER: 50, STAFF: 10 } as const;

const MANAGER_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard.view',
  'customer.view',
  'customer.create',
  'customer.update',
  'customer.export',
  'customer.import',
  'customer.ledger',
  'customer.notes',
  'customer.timeline',
  'category.view',
  'category.create',
  'category.update',
  'inventory.view',
  'inventory.create',
  'inventory.update',
  'inventory.adjust',
  'inventory.export',
  'inventory.import',
  'inventory.transactions',
  'quotation.view',
  'quotation.create',
  'quotation.update',
  'quotation.print',
  'quotation.convert',
  'quotation.cancel',
  'quotation.duplicate',
  'invoice.view',
  'invoice.create',
  'invoice.post',
  'invoice.update',
  'invoice.print',
  'invoice.cancel',
  'payment.view',
  'payment.create',
  'payment.update',
  'payment.print',
  'payment.export',
  'expense.view',
  'expense.create',
  'expense.approve',
  'leave.view',
  'leave.create',
  'leave.cancel',
  'leave.approve',
  'leave.reject',
  'leave.calendar',
  'leave.team',
  'leave.export',
  'employee.view',
  'announcement.view',
  'report.view',
  'report.export',
];

const STAFF_PERMISSIONS: readonly PermissionKey[] = [
  'dashboard.view',
  'customer.view',
  'customer.create',
  'customer.update',
  'customer.ledger',
  'customer.notes',
  'customer.timeline',
  'category.view',
  'inventory.view',
  'inventory.transactions',
  'quotation.view',
  'quotation.create',
  'quotation.update',
  'quotation.print',
  'quotation.convert',
  'quotation.duplicate',
  'invoice.view',
  'invoice.create',
  'invoice.post',
  'invoice.update',
  'invoice.print',
  'payment.view',
  'payment.create',
  'payment.print',
  'expense.view',
  'expense.create',
  'leave.view',
  'leave.create',
  'leave.cancel',
  'leave.calendar',
  'announcement.view',
];

export const ROLE_DEFINITIONS: readonly RoleDefinition[] = [
  {
    name: ROLE_NAMES.ADMIN,
    description: 'Full system access, configuration, and administration.',
    isSystemRole: true,
    level: ROLE_LEVELS.ADMIN,
    permissions: 'ALL',
  },
  {
    name: ROLE_NAMES.MANAGER,
    description: 'Operational management with approval rights; no system configuration.',
    isSystemRole: true,
    level: ROLE_LEVELS.MANAGER,
    permissions: MANAGER_PERMISSIONS,
  },
  {
    name: ROLE_NAMES.STAFF,
    description: 'Limited operational access to assigned work; own leave and expenses.',
    isSystemRole: true,
    level: ROLE_LEVELS.STAFF,
    permissions: STAFF_PERMISSIONS,
  },
];

/** Resolve a role's default permission keys to a concrete array. */
export function permissionsForRole(role: RoleDefinition): readonly PermissionKey[] {
  return role.permissions === 'ALL' ? ALL_PERMISSION_KEYS : role.permissions;
}
