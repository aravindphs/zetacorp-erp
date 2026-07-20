import type { PaymentMethod, PaymentStatus } from '@prisma/client';

export interface PaymentRow {
  id: string;
  paymentNumber: string;
  customerId: string;
  customerName: string;
  invoiceId: string;
  invoiceNumber: string;
  paymentDate: string;
  paymentMethod: PaymentMethod;
  referenceNumber: string | null;
  amount: number;
  status: PaymentStatus;
  receivedBy: string;
}

export interface OutstandingInvoice {
  id: string;
  invoiceNumber: string;
  invoiceDate: string;
  dueDate: string | null;
  customerId: string;
  customerName: string;
  customerPhone: string | null;
  grandTotal: number;
  amountPaid: number;
  balanceDue: number;
}

export const PAYMENT_METHOD_LABELS: Record<PaymentMethod, string> = {
  CASH: 'Cash',
  UPI: 'UPI',
  BANK_TRANSFER: 'Bank transfer',
  CHEQUE: 'Cheque',
  CREDIT_CARD: 'Credit card',
  DEBIT_CARD: 'Debit card',
  OTHER: 'Other',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  PENDING: 'Pending',
  SUCCESS: 'Success',
  FAILED: 'Failed',
  REVERSED: 'Reversed',
  REFUNDED: 'Refunded',
};

export const PAYMENT_STATUS_CLASSES: Record<PaymentStatus, string> = {
  PENDING: 'bg-amber-500/10 text-amber-600',
  SUCCESS: 'bg-green-500/10 text-green-600',
  FAILED: 'bg-destructive/10 text-destructive',
  REVERSED: 'bg-muted text-muted-foreground',
  REFUNDED: 'bg-muted text-muted-foreground',
};

/** Reference number is mandatory for every non-cash method (spec §227). */
export const NON_CASH_METHODS: PaymentMethod[] = [
  'UPI',
  'BANK_TRANSFER',
  'CHEQUE',
  'CREDIT_CARD',
  'DEBIT_CARD',
];
