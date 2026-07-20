import type { QuotationStatus } from '@prisma/client';

export interface QuotationRow {
  id: string;
  quotationNumber: string;
  customerName: string;
  quotationDate: string;
  validUntil: string | null;
  status: QuotationStatus;
  grandTotal: number;
}

export const QUOTATION_STATUS_LABELS: Record<QuotationStatus, string> = {
  DRAFT: 'Draft',
  SENT: 'Sent',
  ACCEPTED: 'Accepted',
  REJECTED: 'Rejected',
  EXPIRED: 'Expired',
  CANCELLED: 'Cancelled',
};

export const QUOTATION_STATUS_CLASSES: Record<QuotationStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  SENT: 'bg-blue-500/10 text-blue-600',
  ACCEPTED: 'bg-green-500/10 text-green-600',
  REJECTED: 'bg-destructive/10 text-destructive',
  EXPIRED: 'bg-amber-500/10 text-amber-600',
  CANCELLED: 'bg-destructive/10 text-destructive',
};
