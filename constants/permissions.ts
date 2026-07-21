/**
 * The permission catalogue — the single source of truth for RBAC (spec §23,
 * §51, §52). Permissions are `module.action` and are NEVER hardcoded as role
 * checks; code checks for the presence of a permission (spec §53) so custom
 * roles work in the future.
 *
 * This list drives both the seed (the `permissions` table) and compile-time
 * permission keys used throughout the app.
 */

export interface PermissionDefinition {
  key: string;
  module: string;
  action: string;
  description: string;
}

export const PERMISSION_DEFINITIONS = [
  // Dashboard
  { key: 'dashboard.view', module: 'dashboard', action: 'view', description: 'View the dashboard' },

  // Customers
  { key: 'customer.view', module: 'customer', action: 'view', description: 'View customers' },
  { key: 'customer.create', module: 'customer', action: 'create', description: 'Create customers' },
  { key: 'customer.update', module: 'customer', action: 'update', description: 'Edit customers' },
  { key: 'customer.delete', module: 'customer', action: 'delete', description: 'Delete customers' },
  { key: 'customer.export', module: 'customer', action: 'export', description: 'Export customers' },
  { key: 'customer.import', module: 'customer', action: 'import', description: 'Import customers' },
  { key: 'customer.ledger', module: 'customer', action: 'ledger', description: 'View customer ledger' },
  { key: 'customer.notes', module: 'customer', action: 'notes', description: 'Manage customer notes' },
  { key: 'customer.timeline', module: 'customer', action: 'timeline', description: 'View customer timeline' },

  // Categories
  { key: 'category.view', module: 'category', action: 'view', description: 'View categories' },
  {
    key: 'category.create',
    module: 'category',
    action: 'create',
    description: 'Create categories',
  },
  { key: 'category.update', module: 'category', action: 'update', description: 'Edit categories' },
  {
    key: 'category.delete',
    module: 'category',
    action: 'delete',
    description: 'Delete categories',
  },

  // Inventory / products
  {
    key: 'inventory.view',
    module: 'inventory',
    action: 'view',
    description: 'View products & stock',
  },
  {
    key: 'inventory.create',
    module: 'inventory',
    action: 'create',
    description: 'Create products',
  },
  { key: 'inventory.update', module: 'inventory', action: 'update', description: 'Edit products' },
  {
    key: 'inventory.delete',
    module: 'inventory',
    action: 'delete',
    description: 'Delete products',
  },
  {
    key: 'inventory.adjust',
    module: 'inventory',
    action: 'adjust',
    description: 'Adjust stock levels',
  },
  {
    key: 'inventory.export',
    module: 'inventory',
    action: 'export',
    description: 'Export products',
  },
  {
    key: 'inventory.import',
    module: 'inventory',
    action: 'import',
    description: 'Import products',
  },
  {
    key: 'inventory.transactions',
    module: 'inventory',
    action: 'transactions',
    description: 'View stock transactions',
  },

  // Quotations
  { key: 'quotation.view', module: 'quotation', action: 'view', description: 'View quotations' },
  {
    key: 'quotation.create',
    module: 'quotation',
    action: 'create',
    description: 'Create quotations',
  },
  {
    key: 'quotation.update',
    module: 'quotation',
    action: 'update',
    description: 'Edit quotations',
  },
  {
    key: 'quotation.delete',
    module: 'quotation',
    action: 'delete',
    description: 'Delete quotations',
  },
  {
    key: 'quotation.print',
    module: 'quotation',
    action: 'print',
    description: 'Print/download quotation PDF',
  },
  {
    key: 'quotation.convert',
    module: 'quotation',
    action: 'convert',
    description: 'Convert quotation to invoice',
  },
  { key: 'quotation.cancel', module: 'quotation', action: 'cancel', description: 'Cancel quotations' },
  { key: 'quotation.duplicate', module: 'quotation', action: 'duplicate', description: 'Duplicate quotations' },

  // Invoices
  { key: 'invoice.view', module: 'invoice', action: 'view', description: 'View invoices' },
  { key: 'invoice.create', module: 'invoice', action: 'create', description: 'Create invoices' },
  { key: 'invoice.post', module: 'invoice', action: 'post', description: 'Post invoices (deduct stock)' },
  { key: 'invoice.update', module: 'invoice', action: 'update', description: 'Edit invoices' },
  { key: 'invoice.delete', module: 'invoice', action: 'delete', description: 'Delete invoices' },
  {
    key: 'invoice.print',
    module: 'invoice',
    action: 'print',
    description: 'Print/download invoice PDF',
  },
  { key: 'invoice.cancel', module: 'invoice', action: 'cancel', description: 'Cancel invoices' },

  // Payments
  { key: 'payment.view', module: 'payment', action: 'view', description: 'View payments' },
  { key: 'payment.create', module: 'payment', action: 'create', description: 'Record payments' },
  { key: 'payment.update', module: 'payment', action: 'update', description: 'Edit payments' },
  { key: 'payment.delete', module: 'payment', action: 'delete', description: 'Delete payments' },
  { key: 'payment.print', module: 'payment', action: 'print', description: 'Print/download payment receipt' },
  { key: 'payment.export', module: 'payment', action: 'export', description: 'Export payments' },

  // Expenses
  { key: 'expense.view', module: 'expense', action: 'view', description: 'View expenses' },
  { key: 'expense.create', module: 'expense', action: 'create', description: 'Submit expenses' },
  { key: 'expense.update', module: 'expense', action: 'update', description: 'Edit expenses' },
  { key: 'expense.delete', module: 'expense', action: 'delete', description: 'Delete expenses' },
  {
    key: 'expense.cancel',
    module: 'expense',
    action: 'cancel',
    description: 'Cancel expense claims',
  },
  { key: 'expense.reject', module: 'expense', action: 'reject', description: 'Reject expenses' },
  {
    key: 'expense.reimburse',
    module: 'expense',
    action: 'reimburse',
    description: 'Record expense reimbursements',
  },
  { key: 'expense.export', module: 'expense', action: 'export', description: 'Export expenses' },
  {
    key: 'expense.category.manage',
    module: 'expense',
    action: 'category_manage',
    description: 'Manage expense categories',
  },
  {
    key: 'expense.approve',
    module: 'expense',
    action: 'approve',
    description: 'Approve/reject expenses',
  },

  // Leave
  { key: 'leave.view', module: 'leave', action: 'view', description: 'View leave requests' },
  { key: 'leave.create', module: 'leave', action: 'create', description: 'Apply for leave' },
  { key: 'leave.update', module: 'leave', action: 'update', description: 'Edit leave requests' },
  { key: 'leave.delete', module: 'leave', action: 'delete', description: 'Delete leave requests' },
  { key: 'leave.approve', module: 'leave', action: 'approve', description: 'Approve/reject leave' },
  { key: 'leave.reject', module: 'leave', action: 'reject', description: 'Reject leave requests' },
  { key: 'leave.cancel', module: 'leave', action: 'cancel', description: 'Cancel leave requests' },
  {
    key: 'leave.calendar',
    module: 'leave',
    action: 'calendar',
    description: 'View the leave calendar',
  },
  { key: 'leave.team', module: 'leave', action: 'team', description: 'View team leave' },
  { key: 'leave.export', module: 'leave', action: 'export', description: 'Export leave requests' },

  // Employees / users
  { key: 'employee.view', module: 'employee', action: 'view', description: 'View employees' },
  {
    key: 'employee.create',
    module: 'employee',
    action: 'create',
    description: 'Create employees & accounts',
  },
  { key: 'employee.update', module: 'employee', action: 'update', description: 'Edit employees' },
  {
    key: 'employee.delete',
    module: 'employee',
    action: 'delete',
    description: 'Deactivate/delete employees',
  },
  {
    key: 'employee.reset_password',
    module: 'employee',
    action: 'reset_password',
    description: 'Reset employee passwords',
  },
  {
    key: 'employee.documents',
    module: 'employee',
    action: 'documents',
    description: 'View/upload employee documents',
  },
  {
    key: 'employee.change_role',
    module: 'employee',
    action: 'change_role',
    description: 'Change an employee role',
  },
  {
    key: 'department.manage',
    module: 'department',
    action: 'manage',
    description: 'Manage departments',
  },
  {
    key: 'designation.manage',
    module: 'designation',
    action: 'manage',
    description: 'Manage designations',
  },

  // Announcements
  {
    key: 'announcement.view',
    module: 'announcement',
    action: 'view',
    description: 'View announcements',
  },
  {
    key: 'announcement.create',
    module: 'announcement',
    action: 'create',
    description: 'Create announcements',
  },
  {
    key: 'announcement.update',
    module: 'announcement',
    action: 'update',
    description: 'Edit announcements',
  },
  {
    key: 'announcement.delete',
    module: 'announcement',
    action: 'delete',
    description: 'Delete announcements',
  },
  {
    key: 'announcement.publish',
    module: 'announcement',
    action: 'publish',
    description: 'Publish announcements',
  },

  // Reports
  { key: 'report.view', module: 'report', action: 'view', description: 'View reports' },
  { key: 'report.export', module: 'report', action: 'export', description: 'Export reports' },

  // Roles & permissions administration
  { key: 'role.view', module: 'role', action: 'view', description: 'View roles' },
  {
    key: 'role.manage',
    module: 'role',
    action: 'manage',
    description: 'Create/edit roles & assign permissions',
  },
  { key: 'permission.view', module: 'permission', action: 'view', description: 'View permissions' },

  // Settings
  { key: 'settings.view', module: 'settings', action: 'view', description: 'View system settings' },
  {
    key: 'settings.manage',
    module: 'settings',
    action: 'manage',
    description: 'Modify system settings',
  },

  // Backup & restore
  { key: 'backup.view', module: 'backup', action: 'view', description: 'View backups' },
  { key: 'backup.create', module: 'backup', action: 'create', description: 'Create backups' },
  { key: 'backup.restore', module: 'backup', action: 'restore', description: 'Restore backups' },

  // Logs & system health
  { key: 'activity.view', module: 'activity', action: 'view', description: 'View activity logs' },
  { key: 'audit.view', module: 'audit', action: 'view', description: 'View audit logs' },
  { key: 'system.monitor', module: 'system', action: 'monitor', description: 'View system health' },
] as const satisfies readonly PermissionDefinition[];

/** Union of every valid permission key — use for compile-time safety. */
export type PermissionKey = (typeof PERMISSION_DEFINITIONS)[number]['key'];

/** All permission keys as a plain array (e.g. for seeding an Admin role). */
export const ALL_PERMISSION_KEYS: readonly PermissionKey[] = PERMISSION_DEFINITIONS.map(
  (p) => p.key,
);
