import {
  Banknote,
  CreditCard,
  FileText,
  Package,
  ReceiptText,
  TrendingUp,
  Users,
  Wallet,
} from 'lucide-react';
import { StatCard, type StatCardProps } from '@/features/dashboard/components/stat-card';
import type { AuthUser } from '@/types/auth';
import { hasPermission } from '@/lib/auth/guards';
import { formatCurrency, formatNumber } from '@/utils/format';
import type { DashboardSummary } from '@/features/dashboard/dashboard.types';

/**
 * Responsive stat-card grid (spec §80). Financial cards (sales/outstanding/
 * revenue) are shown only to users who can view financials; approval cards only
 * to approvers (spec §99).
 */
export function StatCards({ summary, user }: { summary: DashboardSummary; user: AuthUser }) {
  const canViewFinancials = hasPermission(user, 'report.view');
  const cards: StatCardProps[] = [];

  cards.push({
    title: 'Active Customers',
    value: formatNumber(summary.customers.totalActive),
    sub: `+${summary.customers.newThisMonth} this month`,
    icon: Users,
    href: hasPermission(user, 'customer.view') ? '/customers' : undefined,
  });

  cards.push({
    title: 'Products',
    value: formatNumber(summary.products.available),
    sub: `${summary.products.lowStock} low on stock`,
    icon: Package,
    href: hasPermission(user, 'inventory.view') ? '/inventory' : undefined,
  });

  if (canViewFinancials) {
    cards.push({
      title: "Today's Sales",
      value: formatCurrency(summary.todaySales.value),
      changePercent: summary.todaySales.changePercent,
      sub: 'vs yesterday',
      icon: TrendingUp,
    });
    cards.push({
      title: 'Outstanding',
      value: formatCurrency(summary.outstanding.pending),
      sub: `${formatCurrency(summary.outstanding.overdue)} overdue`,
      icon: Banknote,
    });
    cards.push({
      title: 'Monthly Revenue',
      value: formatCurrency(summary.monthlyRevenue.value),
      changePercent: summary.monthlyRevenue.changePercent,
      sub: 'vs last month',
      icon: CreditCard,
    });
  }

  cards.push({
    title: 'Invoices',
    value: formatNumber(summary.invoices.today),
    sub: `${formatNumber(summary.invoices.thisMonth)} this month`,
    icon: ReceiptText,
    href: hasPermission(user, 'invoice.view') ? '/invoices' : undefined,
  });

  if (summary.pendingExpenses !== null) {
    cards.push({
      title: 'Pending Expenses',
      value: formatNumber(summary.pendingExpenses),
      sub: 'awaiting approval',
      icon: Wallet,
      href: '/expenses',
    });
  }

  if (summary.pendingLeave !== null) {
    cards.push({
      title: 'Pending Leave',
      value: formatNumber(summary.pendingLeave),
      sub: 'awaiting approval',
      icon: FileText,
      href: '/leave',
    });
  }

  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {cards.map((card) => (
        <StatCard key={card.title} {...card} />
      ))}
    </div>
  );
}
