import Link from 'next/link';
import { AlertTriangle, PackageX } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatNumber } from '@/utils/format';
import type { DashboardAlerts } from '@/features/dashboard/dashboard.types';

/** Low-stock table (spec §89) — only rendered for inventory viewers. */
export function LowStockAlert({ rows }: { rows: DashboardAlerts['lowStock'] }) {
  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="flex items-center gap-2 text-base">
          <PackageX className="size-4 text-amber-600" />
          Low stock
        </CardTitle>
        <Link href="/inventory" className="text-xs text-primary hover:underline">
          View inventory
        </Link>
      </CardHeader>
      <CardContent>
        {rows.length === 0 ? (
          <p className="py-8 text-center text-sm text-muted-foreground">
            All products are sufficiently stocked.
          </p>
        ) : (
          <ul className="divide-y">
            {rows.map((r) => (
              <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
                <div className="min-w-0">
                  <p className="truncate font-medium">{r.productName}</p>
                  <p className="text-xs text-muted-foreground">{r.categoryName}</p>
                </div>
                <Badge variant="secondary" className="bg-amber-500/10 text-amber-600">
                  {formatNumber(r.currentStock)} / {formatNumber(r.minimumStock)}
                </Badge>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}

/** Pending approvals summary (spec §90). */
export function PendingApprovals({
  approvals,
}: {
  approvals: DashboardAlerts['pendingApprovals'];
}) {
  const items = [
    approvals.expenses !== null
      ? { label: 'Expenses', count: approvals.expenses, href: '/expenses' }
      : null,
    approvals.leave !== null ? { label: 'Leave', count: approvals.leave, href: '/leave' } : null,
  ].filter((i): i is { label: string; count: number; href: string } => i !== null);

  if (items.length === 0) return null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <AlertTriangle className="size-4 text-primary" />
          Pending approvals
        </CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-2 gap-3">
        {items.map((item) => (
          <Link
            key={item.label}
            href={item.href}
            className="rounded-lg border p-4 transition-colors hover:border-primary/40 hover:bg-accent"
          >
            <p className="text-2xl font-semibold tabular-nums">{formatNumber(item.count)}</p>
            <p className="text-sm text-muted-foreground">{item.label}</p>
          </Link>
        ))}
      </CardContent>
    </Card>
  );
}
