/**
 * Default leave types seeded at bootstrap (spec §272). Admins can add more
 * later — these are data rows, not a fixed enum.
 */
export interface LeaveTypeSeed {
  name: string;
  code: string;
  description: string;
  isPaid: boolean;
  requiresDocument: boolean;
}

export const DEFAULT_LEAVE_TYPES: readonly LeaveTypeSeed[] = [
  {
    name: 'Annual Leave',
    code: 'AL',
    description: 'Paid annual/earned leave.',
    isPaid: true,
    requiresDocument: false,
  },
  {
    name: 'Sick Leave',
    code: 'SL',
    description: 'Paid medical leave.',
    isPaid: true,
    requiresDocument: true,
  },
  {
    name: 'Casual Leave',
    code: 'CL',
    description: 'Short-notice casual leave.',
    isPaid: true,
    requiresDocument: false,
  },
  {
    name: 'Emergency Leave',
    code: 'EL',
    description: 'Urgent, unforeseen leave.',
    isPaid: true,
    requiresDocument: false,
  },
  {
    name: 'Loss of Pay',
    code: 'LOP',
    description: 'Unpaid leave.',
    isPaid: false,
    requiresDocument: false,
  },
  {
    name: 'Work From Home',
    code: 'WFH',
    description: 'Remote working day.',
    isPaid: true,
    requiresDocument: false,
  },
];
