/**
 * Sidebar navigation model (spec §77, §105, §135…). Each item declares the
 * permission required to see it (spec §55, §56); the sidebar filters items the
 * user cannot access. `permission: null` means always visible when signed in.
 */
import type { LucideIcon } from 'lucide-react';
import {
  Activity,
  BadgeCheck,
  BarChart3,
  Building2,
  CalendarDays,
  CreditCard,
  DatabaseBackup,
  FileText,
  FolderTree,
  HeartPulse,
  LayoutDashboard,
  Megaphone,
  Package,
  ReceiptText,
  ScrollText,
  Settings,
  ShieldCheck,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import type { PermissionKey } from '@/constants/permissions';

export interface NavItem {
  label: string;
  href: string;
  icon: LucideIcon;
  permission: PermissionKey | null;
}

export interface NavGroup {
  label: string;
  items: NavItem[];
}

export const NAV_GROUPS: readonly NavGroup[] = [
  {
    label: 'Overview',
    items: [
      {
        label: 'Dashboard',
        href: '/dashboard',
        icon: LayoutDashboard,
        permission: 'dashboard.view',
      },
    ],
  },
  {
    label: 'Sales',
    items: [
      { label: 'Customers', href: '/customers', icon: Users, permission: 'customer.view' },
      { label: 'Quotations', href: '/quotations', icon: FileText, permission: 'quotation.view' },
      { label: 'Invoices', href: '/invoices', icon: ReceiptText, permission: 'invoice.view' },
      { label: 'Payments', href: '/payments', icon: CreditCard, permission: 'payment.view' },
    ],
  },
  {
    label: 'Inventory',
    items: [
      { label: 'Products', href: '/inventory', icon: Package, permission: 'inventory.view' },
      {
        label: 'Categories',
        href: '/inventory/categories',
        icon: FolderTree,
        permission: 'category.view',
      },
    ],
  },
  {
    label: 'Workforce',
    items: [
      {
        label: 'Employees',
        href: '/workforce/employees',
        icon: UserCog,
        permission: 'employee.view',
      },
      {
        label: 'Departments',
        href: '/workforce/departments',
        icon: Building2,
        permission: 'employee.view',
      },
      {
        label: 'Designations',
        href: '/workforce/designations',
        icon: BadgeCheck,
        permission: 'employee.view',
      },
      { label: 'Leave', href: '/workforce/leave', icon: CalendarDays, permission: 'leave.view' },
    ],
  },
  {
    label: 'Finance',
    items: [
      { label: 'Expenses', href: '/finance/expenses', icon: Wallet, permission: 'expense.view' },
    ],
  },
  {
    label: 'Insights',
    items: [{ label: 'Reports', href: '/reports', icon: BarChart3, permission: 'report.view' }],
  },
  {
    label: 'Administration',
    items: [
      {
        label: 'Announcements',
        href: '/announcements',
        icon: Megaphone,
        permission: 'announcement.view',
      },
      { label: 'Roles', href: '/roles', icon: ShieldCheck, permission: 'role.view' },
      { label: 'Settings', href: '/settings', icon: Settings, permission: 'settings.view' },
      {
        label: 'Activity Logs',
        href: '/activity-logs',
        icon: Activity,
        permission: 'activity.view',
      },
      { label: 'Audit Logs', href: '/audit-logs', icon: ScrollText, permission: 'audit.view' },
      { label: 'Backups', href: '/backups', icon: DatabaseBackup, permission: 'backup.view' },
      {
        label: 'System Health',
        href: '/system-health',
        icon: HeartPulse,
        permission: 'system.monitor',
      },
    ],
  },
];

/** Filter nav groups down to items the user may access (spec §56). */
export function visibleNavGroups(permissions: ReadonlySet<string>): NavGroup[] {
  return NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter(
      (item) => item.permission === null || permissions.has(item.permission),
    ),
  })).filter((group) => group.items.length > 0);
}
