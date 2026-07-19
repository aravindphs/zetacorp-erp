/**
 * Async dashboard sections (spec §96 — widgets lazy-loaded via Suspense). Each
 * section fetches its own slice so the page streams progressively behind
 * skeleton fallbacks. Rendering is permission-scoped (spec §99–§102).
 */
import { hasPermission } from '@/lib/auth/guards';
import type { AuthUser } from '@/types/auth';
import { Skeleton } from '@/components/ui/skeleton';
import { Card, CardContent, CardHeader } from '@/components/ui/card';
import {
  getDashboardAlerts,
  getDashboardCharts,
  getDashboardRecent,
  getDashboardSummary,
} from '@/features/dashboard/dashboard.service';
import { StatCards } from '@/features/dashboard/components/stat-cards';
import { ChartCard } from '@/features/dashboard/components/chart-card';
import { SalesTrend } from '@/features/dashboard/components/sales-trend';
import {
  InventoryDonut,
  PaymentStatusPie,
  RevenueBarChart,
  TopProductsChart,
} from '@/features/dashboard/components/charts';
import {
  RecentActivities,
  RecentCustomers,
  RecentInvoices,
  RecentPayments,
} from '@/features/dashboard/components/recent-lists';
import { LowStockAlert, PendingApprovals } from '@/features/dashboard/components/alerts';

export async function StatsSection({ user }: { user: AuthUser }) {
  const summary = await getDashboardSummary(user);
  return <StatCards summary={summary} user={user} />;
}

export async function ChartsSection({ user }: { user: AuthUser }) {
  const charts = await getDashboardCharts(user, 'month');
  const canViewFinancials = hasPermission(user, 'report.view');
  const canViewInventory = hasPermission(user, 'inventory.view');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canViewFinancials && (
        <>
          <div className="lg:col-span-2">
            <SalesTrend initialData={charts.salesTrend} />
          </div>
          <ChartCard title="Revenue by month" isEmpty={charts.revenueByMonth.every((m) => m.revenue === 0)}>
            <RevenueBarChart data={charts.revenueByMonth} />
          </ChartCard>
          <ChartCard title="Payment status" isEmpty={charts.paymentStatus.length === 0}>
            <PaymentStatusPie data={charts.paymentStatus} />
          </ChartCard>
          <ChartCard title="Top selling products" isEmpty={charts.topProducts.length === 0}>
            <TopProductsChart data={charts.topProducts} />
          </ChartCard>
        </>
      )}
      {canViewInventory && (
        <ChartCard title="Inventory by category" isEmpty={charts.inventoryByCategory.length === 0}>
          <InventoryDonut data={charts.inventoryByCategory} />
        </ChartCard>
      )}
    </div>
  );
}

export async function RecentSection({ user }: { user: AuthUser }) {
  const recent = await getDashboardRecent(user);
  const canViewFinancials = hasPermission(user, 'report.view');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      <RecentInvoices rows={recent.invoices} />
      {canViewFinancials && <RecentPayments rows={recent.payments} />}
      <RecentCustomers rows={recent.customers} />
      <RecentActivities rows={recent.activities} />
    </div>
  );
}

export async function AlertsSection({ user }: { user: AuthUser }) {
  const alerts = await getDashboardAlerts(user);
  const canViewInventory = hasPermission(user, 'inventory.view');

  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {canViewInventory && <LowStockAlert rows={alerts.lowStock} />}
      <PendingApprovals approvals={alerts.pendingApprovals} />
    </div>
  );
}

// --- Skeleton fallbacks -----------------------------------------------------

export function StatsSkeleton() {
  return (
    <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
      {Array.from({ length: 4 }).map((_, i) => (
        <Card key={i}>
          <CardContent className="p-5">
            <Skeleton className="h-4 w-24" />
            <Skeleton className="mt-3 h-7 w-28" />
            <Skeleton className="mt-3 h-3 w-20" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ChartsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 3 }).map((_, i) => (
        <Card key={i} className={i === 0 ? 'lg:col-span-2' : ''}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent>
            <Skeleton className="h-[260px] w-full" />
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function ListsSkeleton() {
  return (
    <div className="grid gap-4 lg:grid-cols-2">
      {Array.from({ length: 2 }).map((_, i) => (
        <Card key={i}>
          <CardHeader>
            <Skeleton className="h-5 w-32" />
          </CardHeader>
          <CardContent className="space-y-3">
            {Array.from({ length: 4 }).map((_, j) => (
              <Skeleton key={j} className="h-10 w-full" />
            ))}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
