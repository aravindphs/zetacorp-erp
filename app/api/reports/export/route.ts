import { NextResponse } from 'next/server';
import { z } from 'zod';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { ValidationError } from '@/lib/errors';
import { logActivity } from '@/services/activity-log.service';
import { toCsv, type CsvCell } from '@/utils/csv';
import {
  auditReportSchema,
  customerReportSchema,
  employeeReportSchema,
  expenseReportSchema,
  inventoryReportSchema,
  invoiceReportSchema,
  leaveReportSchema,
  paymentReportSchema,
  salesReportSchema,
} from '@/features/reports/report.schema';
import {
  getAuditReport,
  getCustomerReport,
  getEmployeeReport,
  getExpenseReport,
  getInventoryReport,
  getInvoiceReport,
  getLeaveReport,
  getPaymentReport,
  getSalesReport,
} from '@/features/reports/report.queries';

export const dynamic = 'force-dynamic';

/**
 * Export Center (§335). One endpoint serves every report so exports always
 * honour the same filters the page was showing. The report is chosen by the
 * `report` param, defaulting to the referring page's slug.
 */
const REPORTS = [
  'sales',
  'customers',
  'inventory',
  'invoices',
  'payments',
  'employees',
  'leaves',
  'expenses',
  'audit',
] as const;

type ReportName = (typeof REPORTS)[number];

/** Each report exports its most table-like section. */
async function buildCsv(
  report: ReportName,
  params: Record<string, string>,
): Promise<{ headers: string[]; rows: CsvCell[][] }> {
  switch (report) {
    case 'sales': {
      const data = await getSalesReport(salesReportSchema.parse(params));
      return {
        headers: ['Product', 'Quantity', 'Revenue'],
        rows: data.topProducts.map((p) => [p.productName, p.quantity, p.total]),
      };
    }
    case 'customers': {
      const data = await getCustomerReport(customerReportSchema.parse(params));
      return {
        headers: ['Customer Code', 'Customer', 'Total Purchases', 'Outstanding', 'Last Purchase'],
        rows: data.rows.map((c) => [
          c.customerCode,
          c.customerName,
          c.totalPurchases,
          c.outstanding,
          c.lastPurchase ? c.lastPurchase.slice(0, 10) : '',
        ]),
      };
    }
    case 'inventory': {
      const data = await getInventoryReport(inventoryReportSchema.parse(params));
      return {
        headers: ['Product Code', 'Product', 'In Stock', 'Minimum', 'Stock Value'],
        rows: data.rows.map((p) => [
          p.productCode,
          p.productName,
          p.currentStock,
          p.minimumStock,
          p.stockValue,
        ]),
      };
    }
    case 'invoices': {
      const data = await getInvoiceReport(invoiceReportSchema.parse(params));
      return {
        headers: [
          'Invoice',
          'Customer',
          'Date',
          'Due Date',
          'Total',
          'GST',
          'Outstanding',
          'Status',
          'Payment Status',
        ],
        rows: data.rows.map((i) => [
          i.invoiceNumber,
          i.customerName,
          i.invoiceDate.slice(0, 10),
          i.dueDate ? i.dueDate.slice(0, 10) : '',
          i.grandTotal,
          i.gstAmount,
          i.balanceDue,
          i.status,
          i.paymentStatus,
        ]),
      };
    }
    case 'payments': {
      const data = await getPaymentReport(paymentReportSchema.parse(params));
      return {
        headers: ['Method', 'Count', 'Total'],
        rows: data.byMethod.map((m) => [m.method, m.count, m.total]),
      };
    }
    case 'employees': {
      const data = await getEmployeeReport(employeeReportSchema.parse(params));
      return {
        headers: ['Grouping', 'Name', 'Count'],
        rows: [
          ...data.byDepartment.map((d) => ['Department', d.name, d.count] as CsvCell[]),
          ...data.byRole.map((r) => ['Role', r.name, r.count] as CsvCell[]),
        ],
      };
    }
    case 'leaves': {
      const data = await getLeaveReport(leaveReportSchema.parse(params));
      return {
        headers: ['Grouping', 'Name', 'Requests', 'Days'],
        rows: [
          ...data.byStatus.map((s) => ['Status', s.status, s.count, s.days] as CsvCell[]),
          ...data.byType.map((t) => ['Leave type', t.name, t.count, t.days] as CsvCell[]),
          ...data.byDepartment.map((d) => ['Department', d.name, d.count, d.days] as CsvCell[]),
        ],
      };
    }
    case 'expenses': {
      const data = await getExpenseReport(expenseReportSchema.parse(params));
      return {
        headers: ['Grouping', 'Name', 'Claims', 'Amount'],
        rows: [
          ...data.byStatus.map((s) => ['Status', s.status, s.count, s.total] as CsvCell[]),
          ...data.byCategory.map((c) => ['Category', c.name, c.count, c.total] as CsvCell[]),
        ],
      };
    }
    case 'audit': {
      const data = await getAuditReport(auditReportSchema.parse(params));
      return {
        headers: ['When', 'Action', 'Module', 'Actor'],
        rows: data.rows.map((r) => [r.createdAt, r.action, r.module, r.userName]),
      };
    }
  }
}

/** Per-report permission, so an export can never exceed page access (§335). */
const PERMISSION_FOR: Record<ReportName, Parameters<typeof requirePermission>[0]> = {
  sales: 'report.sales',
  customers: 'report.customers',
  inventory: 'report.inventory',
  invoices: 'report.invoices',
  payments: 'report.payments',
  employees: 'report.employees',
  leaves: 'report.leaves',
  expenses: 'report.expenses',
  audit: 'report.audit',
};

export const GET = withApiHandler(async (request, requestId) => {
  const url = new URL(request.url);
  const params = Object.fromEntries(url.searchParams);

  // Fall back to the referring report page so the UI can link without knowing
  // its own slug.
  const referer = request.headers.get('referer') ?? '';
  const inferred = REPORTS.find((r) => referer.includes(`/reports/${r}`));
  const parsed = z.enum(REPORTS).safeParse(params.report ?? inferred);
  if (!parsed.success) {
    throw new ValidationError('Specify which report to export.');
  }
  const report = parsed.data;

  // Exports require both the report's own permission and export rights.
  await requirePermission(PERMISSION_FOR[report]);
  const user = await requirePermission('report.export');

  const { headers, rows } = await buildCsv(report, params);

  await logActivity({
    userId: user.id,
    activity: `Exported the ${report} report`,
    module: 'report',
  });

  return new NextResponse(toCsv(headers, rows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${report}-report-${new Date().toISOString().slice(0, 10)}.csv"`,
      'x-request-id': requestId,
    },
  });
});
