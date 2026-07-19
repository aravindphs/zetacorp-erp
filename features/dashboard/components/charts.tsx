'use client';

/**
 * Recharts dashboard visualisations (spec §81). Presentational client
 * components — data is fetched server-side and passed in. Colours use the
 * theme's chart CSS variables so they adapt to light/dark mode.
 */
import {
  Bar,
  BarChart,
  Cell,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import { formatCurrency, formatNumber } from '@/utils/format';
import type {
  InventoryCategorySlice,
  MonthlyRevenuePoint,
  PaymentStatusSlice,
  TopProduct,
} from '@/features/dashboard/dashboard.types';

const CHART_COLORS = [
  'var(--chart-1)',
  'var(--chart-2)',
  'var(--chart-3)',
  'var(--chart-4)',
  'var(--chart-5)',
];

const PAYMENT_COLORS: Record<PaymentStatusSlice['status'], string> = {
  PAID: '#16a34a',
  PARTIAL: '#f59e0b',
  UNPAID: '#94a3b8',
  OVERDUE: '#ef4444',
};

const axisProps = {
  stroke: 'var(--muted-foreground)',
  fontSize: 12,
  tickLine: false,
  axisLine: false,
} as const;

const tooltipStyle = {
  backgroundColor: 'var(--popover)',
  border: '1px solid var(--border)',
  borderRadius: '0.5rem',
  color: 'var(--popover-foreground)',
  fontSize: '0.8rem',
} as const;

export function RevenueBarChart({ data }: { data: MonthlyRevenuePoint[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} margin={{ left: 8, right: 8, top: 8 }}>
        <XAxis dataKey="month" {...axisProps} />
        <YAxis {...axisProps} width={70} tickFormatter={(v: number) => formatCurrency(v)} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
          formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
        />
        <Bar dataKey="revenue" fill="var(--chart-1)" radius={[4, 4, 0, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function PaymentStatusPie({ data }: { data: PaymentStatusSlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="amount" nameKey="status" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((slice) => (
            <Cell key={slice.status} fill={PAYMENT_COLORS[slice.status]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, _name, item) => [
            `${formatCurrency(Number(value))} (${(item?.payload as PaymentStatusSlice)?.count ?? 0})`,
            (item?.payload as PaymentStatusSlice)?.status ?? '',
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}

export function TopProductsChart({ data }: { data: TopProduct[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <BarChart data={data} layout="vertical" margin={{ left: 8, right: 16 }}>
        <XAxis type="number" {...axisProps} tickFormatter={(v: number) => formatCurrency(v)} />
        <YAxis type="category" dataKey="name" {...axisProps} width={120} />
        <Tooltip
          contentStyle={tooltipStyle}
          cursor={{ fill: 'var(--accent)', opacity: 0.4 }}
          formatter={(value) => [formatCurrency(Number(value)), 'Revenue']}
        />
        <Bar dataKey="revenue" fill="var(--chart-2)" radius={[0, 4, 4, 0]} />
      </BarChart>
    </ResponsiveContainer>
  );
}

export function InventoryDonut({ data }: { data: InventoryCategorySlice[] }) {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <PieChart>
        <Pie data={data} dataKey="stock" nameKey="name" innerRadius={55} outerRadius={90} paddingAngle={2}>
          {data.map((slice, i) => (
            <Cell key={slice.categoryId} fill={CHART_COLORS[i % CHART_COLORS.length]} />
          ))}
        </Pie>
        <Tooltip
          contentStyle={tooltipStyle}
          formatter={(value, _name, item) => [
            formatNumber(Number(value)),
            (item?.payload as InventoryCategorySlice)?.name ?? '',
          ]}
        />
      </PieChart>
    </ResponsiveContainer>
  );
}
