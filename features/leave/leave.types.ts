import type { LeaveStatus } from '@prisma/client';

export interface LeaveRow {
  id: string;
  leaveNumber: string;
  employeeId: string;
  employeeName: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  totalDays: number;
  isHalfDay: boolean;
  status: LeaveStatus;
  appliedDate: string;
  approverName: string | null;
}

export interface LeaveCalendarEntry {
  id: string;
  employeeName: string;
  leaveTypeName: string;
  fromDate: string;
  toDate: string;
  status: LeaveStatus;
}

export const LEAVE_STATUS_LABELS: Record<LeaveStatus, string> = {
  DRAFT: 'Draft',
  PENDING: 'Pending',
  APPROVED: 'Approved',
  REJECTED: 'Rejected',
  CANCELLED: 'Cancelled',
  COMPLETED: 'Completed',
};

export const LEAVE_STATUS_CLASSES: Record<LeaveStatus, string> = {
  DRAFT: 'bg-muted text-muted-foreground',
  PENDING: 'bg-amber-500/10 text-amber-600',
  APPROVED: 'bg-green-500/10 text-green-600',
  REJECTED: 'bg-destructive/10 text-destructive',
  CANCELLED: 'bg-muted text-muted-foreground',
  COMPLETED: 'bg-blue-500/10 text-blue-600',
};

/** Statuses an employee may still withdraw (§287). */
export const CANCELLABLE_STATUSES: LeaveStatus[] = ['DRAFT', 'PENDING'];

/** Only DRAFT requests are editable (§287). */
export const EDITABLE_STATUSES: LeaveStatus[] = ['DRAFT'];
