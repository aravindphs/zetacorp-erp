import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import {
  BarChart3,
  CalendarPlus,
  FilePlus2,
  PackagePlus,
  ReceiptText,
  UserPlus,
  Wallet,
} from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import type { AuthUser } from '@/types/auth';
import { hasPermission } from '@/lib/auth/guards';
import type { PermissionKey } from '@/constants/permissions';

/** Quick actions, filtered by permission (spec §82). */
const ACTIONS: { label: string; href: string; icon: LucideIcon; permission: PermissionKey }[] = [
  { label: 'New Customer', href: '/customers/new', icon: UserPlus, permission: 'customer.create' },
  { label: 'New Quotation', href: '/quotations/new', icon: FilePlus2, permission: 'quotation.create' },
  { label: 'New Invoice', href: '/invoices/new', icon: ReceiptText, permission: 'invoice.create' },
  { label: 'Record Payment', href: '/payments/new', icon: Wallet, permission: 'payment.create' },
  { label: 'Add Product', href: '/inventory/new', icon: PackagePlus, permission: 'inventory.create' },
  { label: 'Add Expense', href: '/expenses/new', icon: Wallet, permission: 'expense.create' },
  { label: 'Apply Leave', href: '/leave/new', icon: CalendarPlus, permission: 'leave.create' },
  { label: 'View Reports', href: '/reports', icon: BarChart3, permission: 'report.view' },
];

export function QuickActions({ user }: { user: AuthUser }) {
  const actions = ACTIONS.filter((a) => hasPermission(user, a.permission));
  if (actions.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Quick actions</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {actions.map((action) => (
          <Link
            key={action.href}
            href={action.href}
            className="flex flex-col items-center gap-2 rounded-lg border p-4 text-center text-sm transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <action.icon className="size-5 text-primary" />
            <span>{action.label}</span>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
