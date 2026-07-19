/**
 * Declarative page → required-permission map (spec §55).
 *
 * The middleware uses this only for the coarse authenticated/anonymous gate;
 * fine-grained permission enforcement happens server-side in the dashboard
 * layout (which can query the DB), rendering a Permission Denied state (spec
 * §11, §56) rather than a hard redirect. Order matters: the most specific
 * prefix must come first.
 */
import type { PermissionKey } from '@/constants/permissions';

interface RoutePermission {
  prefix: string;
  permission: PermissionKey;
}

/** Longest-prefix-first so `/quotations/new` matches before `/quotations`. */
export const ROUTE_PERMISSIONS: readonly RoutePermission[] = [
  { prefix: '/customers', permission: 'customer.view' },
  { prefix: '/inventory', permission: 'inventory.view' },
  { prefix: '/categories', permission: 'category.view' },
  { prefix: '/quotations', permission: 'quotation.view' },
  { prefix: '/invoices', permission: 'invoice.view' },
  { prefix: '/payments', permission: 'payment.view' },
  { prefix: '/expenses', permission: 'expense.view' },
  { prefix: '/leave', permission: 'leave.view' },
  { prefix: '/employees', permission: 'employee.view' },
  { prefix: '/announcements', permission: 'announcement.view' },
  { prefix: '/reports', permission: 'report.view' },
  { prefix: '/settings', permission: 'settings.view' },
  { prefix: '/roles', permission: 'role.view' },
  { prefix: '/audit-logs', permission: 'audit.view' },
  { prefix: '/activity-logs', permission: 'activity.view' },
  { prefix: '/system-health', permission: 'system.monitor' },
  { prefix: '/backups', permission: 'backup.view' },
];

/** The permission required to view a given pathname, if any. */
export function requiredPermissionForPath(pathname: string): PermissionKey | null {
  const match = ROUTE_PERMISSIONS.find(
    (r) => pathname === r.prefix || pathname.startsWith(`${r.prefix}/`),
  );
  return match ? match.permission : null;
}
