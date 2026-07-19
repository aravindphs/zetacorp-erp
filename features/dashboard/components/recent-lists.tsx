import Link from 'next/link';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';
import type {
  RecentActivityRow,
  RecentCustomerRow,
  RecentInvoiceRow,
  RecentPaymentRow,
} from '@/features/dashboard/dashboard.types';

function WidgetCard({
  title,
  href,
  isEmpty,
  emptyLabel,
  children,
}: {
  title: string;
  href?: string;
  isEmpty: boolean;
  emptyLabel: string;
  children: React.ReactNode;
}) {
  return (
    <Card className="flex flex-col">
      <CardHeader className="flex flex-row items-center justify-between space-y-0">
        <CardTitle className="text-base">{title}</CardTitle>
        {href && (
          <Link href={href} className="text-xs text-primary hover:underline">
            View all
          </Link>
        )}
      </CardHeader>
      <CardContent className="flex-1">
        {isEmpty ? (
          <p className="py-8 text-center text-sm text-muted-foreground">{emptyLabel}</p>
        ) : (
          children
        )}
      </CardContent>
    </Card>
  );
}

const PAYMENT_STATUS_VARIANT: Record<string, string> = {
  PAID: 'bg-green-500/10 text-green-600',
  PARTIAL: 'bg-amber-500/10 text-amber-600',
  UNPAID: 'bg-muted text-muted-foreground',
  OVERDUE: 'bg-destructive/10 text-destructive',
};

export function RecentInvoices({ rows }: { rows: RecentInvoiceRow[] }) {
  return (
    <WidgetCard title="Recent invoices" href="/invoices" isEmpty={rows.length === 0} emptyLabel="No invoices yet.">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {r.invoiceNumber} · {formatDate(r.invoiceDate)}
              </p>
            </div>
            <div className="flex flex-col items-end gap-1">
              <span className="font-medium tabular-nums">{formatCurrency(r.grandTotal)}</span>
              <Badge className={PAYMENT_STATUS_VARIANT[r.paymentStatus] ?? ''} variant="secondary">
                {r.paymentStatus}
              </Badge>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentPayments({ rows }: { rows: RecentPaymentRow[] }) {
  return (
    <WidgetCard title="Recent payments" href="/payments" isEmpty={rows.length === 0} emptyLabel="No payments yet.">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.customerName}</p>
              <p className="text-xs text-muted-foreground">
                {r.paymentNumber} · {r.method} · {formatDate(r.paymentDate)}
              </p>
            </div>
            <span className="font-medium tabular-nums text-green-600">{formatCurrency(r.amount)}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentCustomers({ rows }: { rows: RecentCustomerRow[] }) {
  return (
    <WidgetCard title="Recent customers" href="/customers" isEmpty={rows.length === 0} emptyLabel="No customers yet.">
      <ul className="divide-y">
        {rows.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-2.5 text-sm">
            <div className="min-w-0">
              <p className="truncate font-medium">{r.customerName}</p>
              <p className="text-xs text-muted-foreground">{r.phone}</p>
            </div>
            <span className="text-xs text-muted-foreground">{formatDate(r.createdAt)}</span>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}

export function RecentActivities({ rows }: { rows: RecentActivityRow[] }) {
  return (
    <WidgetCard title="Recent activity" isEmpty={rows.length === 0} emptyLabel="No activity yet.">
      <ul className="space-y-3">
        {rows.map((r) => (
          <li key={r.id} className="flex items-start gap-3 text-sm">
            <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
            <div className="min-w-0">
              <p className="truncate">
                <span className="font-medium">{r.userName}</span> — {r.activity}
              </p>
              <p className="text-xs text-muted-foreground">
                {r.module} · {formatDateTime(r.createdAt)}
              </p>
            </div>
          </li>
        ))}
      </ul>
    </WidgetCard>
  );
}
