import type { InvoicePaymentStatus, InvoiceStatus } from '@prisma/client';

export interface InvoiceRow {
  id: string;
  invoiceNumber: string;
  customerName: string;
  invoiceDate: string;
  dueDate: string | null;
  status: InvoiceStatus;
  paymentStatus: InvoicePaymentStatus;
  grandTotal: number;
  balanceDue: number;
}

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  DRAFT: 'Draft',
  POSTED: 'Posted',
  CANCELLED: 'Cancelled',
};

export const INVOICE_STATUS_CLASSES: Record<InvoiceStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  POSTED: 'bg-blue-500/10 text-blue-600',
  CANCELLED: 'bg-destructive/10 text-destructive',
};

export const PAYMENT_STATUS_LABELS: Record<InvoicePaymentStatus, string> = {
  UNPAID: 'Unpaid',
  PARTIAL: 'Partial',
  PAID: 'Paid',
  OVERDUE: 'Overdue',
};

export const PAYMENT_STATUS_CLASSES: Record<InvoicePaymentStatus, string> = {
  UNPAID: 'bg-muted text-muted-foreground',
  PARTIAL: 'bg-amber-500/10 text-amber-600',
  PAID: 'bg-green-500/10 text-green-600',
  OVERDUE: 'bg-destructive/10 text-destructive',
};
