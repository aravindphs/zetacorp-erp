import Link from 'next/link';
import type { LucideIcon } from 'lucide-react';
import { ArrowDownRight, ArrowUpRight } from 'lucide-react';
import { Card, CardContent } from '@/components/ui/card';
import { cn } from '@/lib/utils';

export interface StatCardProps {
  title: string;
  value: string;
  sub?: string;
  icon: LucideIcon;
  href?: string;
  /** Percentage change vs. a comparison period; drives the trend badge. */
  changePercent?: number | null;
}

export function StatCard({ title, value, sub, icon: Icon, href, changePercent }: StatCardProps) {
  const body = (
    <Card className={cn('transition-colors', href && 'hover:border-primary/40')}>
      <CardContent className="flex items-start justify-between gap-3 p-5">
        <div className="min-w-0 space-y-1">
          <p className="text-sm text-muted-foreground">{title}</p>
          <p className="truncate text-2xl font-semibold tabular-nums">{value}</p>
          <div className="flex items-center gap-2">
            {typeof changePercent === 'number' && <TrendBadge changePercent={changePercent} />}
            {sub && <span className="text-xs text-muted-foreground">{sub}</span>}
          </div>
        </div>
        <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary">
          <Icon className="size-5" />
        </div>
      </CardContent>
    </Card>
  );

  return href ? (
    <Link href={href} className="block focus-visible:outline-none">
      {body}
    </Link>
  ) : (
    body
  );
}

function TrendBadge({ changePercent }: { changePercent: number }) {
  const positive = changePercent >= 0;
  return (
    <span
      className={cn(
        'inline-flex items-center gap-0.5 rounded-full px-1.5 py-0.5 text-xs font-medium',
        positive ? 'bg-green-500/10 text-green-600' : 'bg-destructive/10 text-destructive',
      )}
    >
      {positive ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}
      {Math.abs(changePercent)}%
    </span>
  );
}
