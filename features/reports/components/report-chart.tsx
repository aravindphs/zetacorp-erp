'use client';

/**
 * Report charts (spec §332) built on Recharts.
 *
 * Recharts v3 gotcha: the Tooltip `formatter` receives `ValueType | undefined`,
 * so the value is coerced rather than annotated as `number`.
 */
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Legend,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { formatCurrency, formatNumber } from '@/utils/format';

/** Categorical palette — readable in both light and dark themes. */
const COLORS = [
  'var(--chart-1, #2563eb)',
  'var(--chart-2, #16a34a)',
  'var(--chart-3, #d97706)',
  'var(--chart-4, #dc2626)',
  'var(--chart-5, #7c3aed)',
  'var(--chart-6, #0891b2)',
];

const axisProps = {
  stroke: 'currentColor',
  fontSize: 11,
  tickLine: false,
  axisLine: false,
  className: 'text-muted-foreground',
};

function ChartFrame({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <Card className="break-inside-avoid">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-semibold">{title}</CardTitle>
      </CardHeader>
      <CardContent className="h-[260px] pt-0">
        <ResponsiveContainer width="100%" height="100%">
          {children as React.ReactElement}
        </ResponsiveContainer>
      </CardContent>
    </Card>
  );
}

export function TrendChart({
  title,
  data,
  currency = true,
}: {
  title: string;
  data: { label: string; value: number }[];
  currency?: boolean;
}) {
  const fmt = (v: number) => (currency ? formatCurrency(v) : formatNumber(v));
  return (
    <ChartFrame title={title}>
      <LineChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis dataKey="label" {...axisProps} />
        <YAxis {...axisProps} width={70} tickFormatter={(v) => fmt(Number(v))} />
        <Tooltip
          formatter={(value) => fmt(Number(value))}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Line
          type="monotone"
          dataKey="value"
          stroke={COLORS[0]}
          strokeWidth={2}
          dot={false}
          name="Total"
        />
      </LineChart>
    </ChartFrame>
  );
}

export function CategoryBarChart({
  title,
  data,
  currency = true,
}: {
  title: string;
  data: { label: string; value: number }[];
  currency?: boolean;
}) {
  const fmt = (v: number) => (currency ? formatCurrency(v) : formatNumber(v));
  return (
    <ChartFrame title={title}>
      <BarChart data={data} margin={{ top: 8, right: 8, left: 8, bottom: 0 }}>
        <CartesianGrid strokeDasharray="3 3" className="stroke-muted" vertical={false} />
        <XAxis dataKey="label" {...axisProps} interval={0} angle={-15} textAnchor="end" height={50} />
        <YAxis {...axisProps} width={70} tickFormatter={(v) => fmt(Number(v))} />
        <Tooltip
          formatter={(value) => fmt(Number(value))}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
        <Bar dataKey="value" fill={COLORS[0]} radius={[4, 4, 0, 0]} name="Total" />
      </BarChart>
    </ChartFrame>
  );
}

export function DistributionPieChart({
  title,
  data,
  currency = false,
}: {
  title: string;
  data: { label: string; value: number }[];
  currency?: boolean;
}) {
  const fmt = (v: number) => (currency ? formatCurrency(v) : formatNumber(v));
  return (
    <ChartFrame title={title}>
      <PieChart>
        <Pie
          data={data}
          dataKey="value"
          nameKey="label"
          cx="50%"
          cy="50%"
          innerRadius={50}
          outerRadius={85}
          paddingAngle={2}
        >
          {data.map((_, i) => (
            <Cell key={i} fill={COLORS[i % COLORS.length]} />
          ))}
        </Pie>
        <Legend verticalAlign="bottom" height={28} wrapperStyle={{ fontSize: 11 }} />
        <Tooltip
          formatter={(value) => fmt(Number(value))}
          contentStyle={{
            background: 'var(--popover)',
            border: '1px solid var(--border)',
            borderRadius: 8,
            fontSize: 12,
          }}
        />
      </PieChart>
    </ChartFrame>
  );
}
