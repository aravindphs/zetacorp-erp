/**
 * Dashboard payload types (spec §80–§90, §94). All monetary values are plain
 * numbers (Prisma Decimals are converted in the service) so they serialise
 * cleanly to Client Components.
 */

export interface TrendStat {
  value: number;
  /** Percentage change vs. the comparison period; null when not comparable. */
  changePercent: number | null;
}

export interface DashboardSummary {
  customers: { totalActive: number; newThisMonth: number };
  products: { available: number; lowStock: number };
  todaySales: TrendStat;
  outstanding: { pending: number; overdue: number };
  monthlyRevenue: TrendStat;
  invoices: { today: number; thisMonth: number };
  /** Present only when the user may approve expenses. */
  pendingExpenses: number | null;
  /** Present only when the user may approve leave. */
  pendingLeave: number | null;
}

export type ChartRange = 'today' | 'week' | 'month' | 'quarter' | 'year';

export interface SalesTrendPoint {
  label: string;
  revenue: number;
  invoices: number;
  averageSale: number;
}

export interface MonthlyRevenuePoint {
  month: string;
  revenue: number;
}

export interface PaymentStatusSlice {
  status: 'PAID' | 'PARTIAL' | 'UNPAID' | 'OVERDUE';
  count: number;
  amount: number;
}

export interface TopProduct {
  productId: string | null;
  name: string;
  quantity: number;
  revenue: number;
}

export interface InventoryCategorySlice {
  categoryId: string;
  name: string;
  stock: number;
}

export interface DashboardCharts {
  salesTrend: SalesTrendPoint[];
  revenueByMonth: MonthlyRevenuePoint[];
  paymentStatus: PaymentStatusSlice[];
  topProducts: TopProduct[];
  inventoryByCategory: InventoryCategorySlice[];
}

export interface RecentInvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  grandTotal: number;
  paymentStatus: string;
  invoiceDate: string;
}

export interface RecentPaymentRow {
  id: string;
  paymentNumber: string;
  customerName: string;
  invoiceNumber: string;
  method: string;
  amount: number;
  paymentDate: string;
}

export interface RecentCustomerRow {
  id: string;
  customerName: string;
  phone: string;
  createdAt: string;
}

export interface RecentActivityRow {
  id: string;
  userName: string;
  activity: string;
  module: string;
  createdAt: string;
}

export interface DashboardRecent {
  invoices: RecentInvoiceRow[];
  payments: RecentPaymentRow[];
  customers: RecentCustomerRow[];
  activities: RecentActivityRow[];
}

export interface LowStockRow {
  id: string;
  productName: string;
  categoryName: string;
  currentStock: number;
  minimumStock: number;
}

export interface DashboardAlerts {
  lowStock: LowStockRow[];
  pendingApprovals: {
    expenses: number | null;
    leave: number | null;
  };
}
