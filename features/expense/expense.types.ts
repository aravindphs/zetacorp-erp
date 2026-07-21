import type { ExpenseReceiptType, ExpenseStatus, PaymentMethod } from '@prisma/client';

export interface ExpenseRow {
  id: string;
  expenseNumber: string;
  employeeId: string;
  employeeName: string;
  categoryName: string;
  expenseDate: string;
  amount: number;
  currency: string;
  status: ExpenseStatus;
  submittedDate: string;
  approverName: string | null;
  reimbursedAt: string | null;
}

export interface ExpenseReceiptRow {
  id: string;
  receiptType: ExpenseReceiptType;
  fileName: string;
  mimeType: string;
  fileSize: number;
  createdAt: string;
}

export const EXPENSE_STATUS_LABELS: Record<ExpenseStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  REIMBURSED: 'Reimbursed',
  CANCELLED: 'Cancelled',
};

export const EXPENSE_STATUS_CLASSES: Record<ExpenseStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/10 text-amber-600',
  APPROVED: 'bg-green-500/10 text-green-600',
  REJECTED: 'bg-destructive/10 text-destructive',
  REIMBURSED: 'bg-blue-500/10 text-blue-600',
  CANCELLED: 'bg-muted text-muted-foreground',
};

export const RECEIPT_TYPE_LABELS: Record<ExpenseReceiptType, string> = {
  INVOICE: 'Invoice',
  BILL: 'Bill',
  RECEIPT: 'Receipt',
  TRAVEL_TICKET: 'Travel ticket',
  OTHER: 'Other',
};

export const REIMBURSEMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  OTHER: 'Other',
};

/** Only drafts are editable (§311). */
export const EDITABLE_STATUSES: ExpenseStatus[] = ['DRAFT'];

/** Drafts and pending claims can still be withdrawn (§311). */
export const CANCELLABLE_STATUSES: ExpenseStatus[] = ['DRAFT', 'PENDING'];

/** Receipt uploads (§305): PDF/PNG/JPG/JPEG, max 10 MB. */
export const RECEIPT_MAX_BYTES = 10 * 1024 * 1024;
export const RECEIPT_ALLOWED_MIME = ['application/pdf', 'image/png', 'image/jpeg'] as const;
