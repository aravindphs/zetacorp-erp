import type { Metadata } from 'next';
import Link from 'next/link';
import {
  BarChart3,
  Boxes,
  CalendarDays,
  CreditCard,
  ReceiptText,
  ScrollText,
  TrendingUp,
  UserCog,
  Users,
  Wallet,
} from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { Card, CardContent } from '@/components/ui/card';
import type { PermissionKey } from '@/constants/permissions';

export const metadata: Metadata = { title: 'Reports' };

const REPORTS: {
  label: string;
  href: string;
  description: string;
  icon: typeof BarChart3;
  permission: PermissionKey;
}[] = [
  {
    label: 'Executive dashboard',
    href: '/reports/executive',
    description: 'Revenue, outstanding, and organisation-wide highlights.',
    icon: TrendingUp,
    permission: 'report.view',
  },
  {
    label: 'Sales',
    href: '/reports/sales',
    description: 'Invoice volume, tax collected, and top-selling products.',
    icon: BarChart3,
    permission: 'report.sales',
  },
  {
    label: 'Customers',
    href: '/reports/customers',
    description: 'Purchases, outstanding balances, and last activity.',
    icon: Users,
    permission: 'report.customers',
  },
  {
    label: 'Inventory',
    href: '/reports/inventory',
    description: 'Stock levels, inventory value, and fast movers.',
    icon: Boxes,
    permission: 'report.inventory',
  },
  {
    label: 'Invoices',
    href: '/reports/invoices',
    description: 'Invoice register with GST and payment status.',
    icon: ReceiptText,
    permission: 'report.invoices',
  },
  {
    label: 'Payments',
    href: '/reports/payments',
    description: 'Collections by method and outstanding balances.',
    icon: CreditCard,
    permission: 'report.payments',
  },
  {
    label: 'Employees',
    href: '/reports/employees',
    description: 'Headcount by department and role, recent logins.',
    icon: UserCog,
    permission: 'report.employees',
  },
  {
    label: 'Leave',
    href: '/reports/leaves',
    description: 'Approved, pending, and rejected leave by department.',
    icon: CalendarDays,
    permission: 'report.leaves',
  },
  {
    label: 'Expenses',
    href: '/reports/expenses',
    description: 'Claim amounts by status, category, and trend.',
    icon: Wallet,
    permission: 'report.expenses',
  },
  {
    label: 'Audit',
    href: '/reports/audit',
    description: 'Security-sensitive actions and their actors.',
    icon: ScrollText,
    permission: 'report.audit',
  },
];

export default async function ReportsPage() {
  const user = await requirePermission('report.view');
  const visible = REPORTS.filter((r) => hasPermission(user, r.permission));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Reports"
        description="Operational and financial insights across every module."
      />
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {visible.map((r) => (
          <Link key={r.href} href={r.href} className="group">
            <Card className="h-full transition-colors group-hover:border-primary/50">
              <CardContent className="flex items-start gap-3 p-4">
                <span className="rounded-md bg-muted p-2">
                  <r.icon className="size-5 text-muted-foreground" />
                </span>
                <div className="min-w-0">
                  <p className="font-medium group-hover:text-primary">{r.label}</p>
                  <p className="mt-0.5 text-sm text-muted-foreground">{r.description}</p>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
