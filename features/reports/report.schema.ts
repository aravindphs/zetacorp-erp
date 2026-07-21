/**
 * Report filtering (spec §322). Every report shares a date range plus its own
 * dimension filters; all are optional and validated server-side.
 */
import { z } from 'zod';
import {
  ExpenseStatus,
  InvoiceStatus,
  LeaveStatus,
  PaymentMethod,
  ProductStatus,
  UserStatus,
} from '@prisma/client';

/** Shared by every report (§322). */
export const reportRangeSchema = z.object({
  fromDate: z.string().trim().min(1).optional(),
  toDate: z.string().trim().min(1).optional(),
});

export const salesReportSchema = reportRangeSchema.extend({
  customerId: z.string().uuid().optional(),
  categoryId: z.string().uuid().optional(),
  productId: z.string().uuid().optional(),
});

export const customerReportSchema = reportRangeSchema.extend({
  status: z.enum(['ACTIVE', 'INACTIVE', 'BLACKLISTED', 'ARCHIVED']).optional(),
  state: z.string().trim().max(80).optional(),
});

export const inventoryReportSchema = reportRangeSchema.extend({
  categoryId: z.string().uuid().optional(),
  status: z.nativeEnum(ProductStatus).optional(),
});

export const invoiceReportSchema = reportRangeSchema.extend({
  status: z.nativeEnum(InvoiceStatus).optional(),
  customerId: z.string().uuid().optional(),
});

export const paymentReportSchema = reportRangeSchema.extend({
  method: z.nativeEnum(PaymentMethod).optional(),
  customerId: z.string().uuid().optional(),
});

export const employeeReportSchema = z.object({
  departmentId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  status: z.nativeEnum(UserStatus).optional(),
});

export const leaveReportSchema = reportRangeSchema.extend({
  departmentId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  status: z.nativeEnum(LeaveStatus).optional(),
});

export const expenseReportSchema = reportRangeSchema.extend({
  expenseCategoryId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  status: z.nativeEnum(ExpenseStatus).optional(),
});

export const auditReportSchema = reportRangeSchema.extend({
  userId: z.string().uuid().optional(),
  module: z.string().trim().max(50).optional(),
  action: z.string().trim().max(50).optional(),
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
});

export type ReportRange = z.infer<typeof reportRangeSchema>;
export type SalesReportQuery = z.infer<typeof salesReportSchema>;
export type CustomerReportQuery = z.infer<typeof customerReportSchema>;
export type InventoryReportQuery = z.infer<typeof inventoryReportSchema>;
export type InvoiceReportQuery = z.infer<typeof invoiceReportSchema>;
export type PaymentReportQuery = z.infer<typeof paymentReportSchema>;
export type EmployeeReportQuery = z.infer<typeof employeeReportSchema>;
export type LeaveReportQuery = z.infer<typeof leaveReportSchema>;
export type ExpenseReportQuery = z.infer<typeof expenseReportSchema>;
export type AuditReportQuery = z.infer<typeof auditReportSchema>;

/**
 * Resolve a range to concrete dates, defaulting to the current month so a
 * report never scans the whole table (§340).
 */
export function resolveRange(range: ReportRange): { from: Date; to: Date } {
  const now = new Date();
  const from = range.fromDate
    ? new Date(range.fromDate)
    : new Date(now.getFullYear(), now.getMonth(), 1);
  const to = range.toDate
    ? new Date(`${range.toDate}T23:59:59.999`)
    : new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999);
  return { from, to };
}
