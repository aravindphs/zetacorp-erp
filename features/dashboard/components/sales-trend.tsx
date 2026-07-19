'use client';

/**
 * Sales trend line chart with a live date-range filter (spec §81). Fetches the
 * charts endpoint on range change so filtering stays server-driven.
 */
import { useEffect, useState } from 'react';
import { CartesianGrid, Line, LineChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts';
import { ChartCard } from '@/features/dashboard/components/chart-card';
import { Button } from '@/components/ui/button';
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';
import { formatCurrency } from '@/utils/format';
import type { ApiResponse } from '@/types/api';
import type { ChartRange, DashboardCharts, SalesTrendPoint } from '@/features/dashboard/dashboard.types';

const RANGES: { value: ChartRange; label: string }[] = [
  { value: 'today', label: 'Today' },
  { value: 'week', label: 'Week' },
  { value: 'month', label: 'Month' },
  { value: 'quarter', label: 'Quarter' },
  { value: 'year', label: 'Year' },
];

export function SalesTrend({ initialData }: { initialData: SalesTrendPoint[] }) {
  const [range, setRange] = useState<ChartRange>('month');
  const [data, setData] = useState<SalesTrendPoint[]>(initialData);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState(false);

  useEffect(() => {
    if (range === 'month') {
      setData(initialData);
      return;
    }
    let cancelled = false;
    setLoading(true);
    setError(false);
    fetch(`/api/dashboard/charts?range=${range}`)
      .then((r) => r.json() as Promise<ApiResponse<DashboardCharts>>)
      .then((json) => {
        if (cancelled) return;
        if (json.success) setData(json.data.salesTrend);
        else setError(true);
      })
      .catch(() => !cancelled && setError(true))
      .finally(() => !cancelled && setLoading(false));
    return () => {
      cancelled = true;
    };
  }, [range, initialData]);

  const rangeSelector = (
    <div className="flex flex-wrap gap-1">
      {RANGES.map((r) => (
        <Button
          key={r.value}
          size="sm"
          variant={range === r.value ? 'secondary' : 'ghost'}
          className={cn('h-7 px-2 text-xs')}
          onClick={() => setRange(r.value)}
        >
          {r.label}
        </Button>
      ))}
    </div>
  );

  return (
    <ChartCard
      title="Sales trend"
      action={rangeSelector}
      isEmpty={!loading && !error && data.length === 0}
      emptyLabel="No sales in this period."
    >
      {loading ? (
        <Skeleton className="h-[260px] w-full" />
      ) : error ? (
        <div className="flex h-[260px] items-center justify-center text-sm text-destructive">
          Unable to load chart.
        </div>
      ) : (
        <ResponsiveContainer width="100%" height={260}>
          <LineChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
            <CartesianGrid strokeDasharray="3 3" stroke="var(--border)" vertical={false} />
            <XAxis dataKey="label" stroke="var(--muted-foreground)" fontSize={12} tickLine={false} axisLine={false} />
            <YAxis
              stroke="var(--muted-foreground)"
              fontSize={12}
              width={70}
              tickLine={false}
              axisLine={false}
              tickFormatter={(v: number) => formatCurrency(v)}
            />
            <Tooltip
              contentStyle={{
                backgroundColor: 'var(--popover)',
                border: '1px solid var(--border)',
                borderRadius: '0.5rem',
                fontSize: '0.8rem',
              }}
              formatter={(value, name) => [
                name === 'revenue' ? formatCurrency(Number(value)) : Number(value),
                name === 'revenue' ? 'Revenue' : name === 'invoices' ? 'Invoices' : 'Avg sale',
              ]}
            />
            <Line type="monotone" dataKey="revenue" stroke="var(--chart-1)" strokeWidth={2} dot={false} />
          </LineChart>
        </ResponsiveContainer>
      )}
    </ChartCard>
  );
}
