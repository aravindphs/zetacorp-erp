/**
 * UI-facing customer types (serialisable — money/dates already normalised by
 * the service).
 */
import type { CustomerStatus, CustomerType } from '@prisma/client';

export interface CustomerRow {
  id: string;
  customerCode: string;
  customerName: string;
  companyName: string | null;
  phone: string;
  gstNumber: string | null;
  customerType: CustomerType;
  status: CustomerStatus;
  city: string | null;
  outstanding: number;
  createdAt: string;
}

export const CUSTOMER_TYPE_LABELS: Record<CustomerType, string> = {
  INDIVIDUAL: 'Individual',
  BUSINESS: 'Business',
  GOVERNMENT: 'Government',
  DEALER: 'Dealer',
  DISTRIBUTOR: 'Distributor',
};

export const CUSTOMER_STATUS_LABELS: Record<CustomerStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  BLACKLISTED: 'Blacklisted',
  ARCHIVED: 'Archived',
};

export const CUSTOMER_STATUS_CLASSES: Record<CustomerStatus, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  INACTIVE: 'bg-muted text-muted-foreground',
  BLACKLISTED: 'bg-destructive/10 text-destructive',
  ARCHIVED: 'bg-amber-500/10 text-amber-600',
};
