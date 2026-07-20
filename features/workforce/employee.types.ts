import type {
  EmployeeDocumentType,
  EmploymentType,
  Gender,
  MaritalStatus,
  UserStatus,
} from '@prisma/client';

export interface EmployeeRow {
  id: string;
  employeeCode: string;
  fullName: string;
  email: string;
  phone: string | null;
  profilePhoto: string | null;
  departmentName: string | null;
  designationName: string | null;
  roleName: string;
  joiningDate: string | null;
  status: UserStatus;
}

/** Lightweight option for manager / reporting-manager pickers. */
export interface EmployeeOption {
  id: string;
  fullName: string;
  employeeCode: string;
}

export const EMPLOYEE_STATUS_LABELS: Record<UserStatus, string> = {
  ACTIVE: 'Active',
  INACTIVE: 'Inactive',
  ON_LEAVE: 'On leave',
  SUSPENDED: 'Suspended',
  TERMINATED: 'Terminated',
};

export const EMPLOYEE_STATUS_CLASSES: Record<UserStatus, string> = {
  ACTIVE: 'bg-green-500/10 text-green-600',
  INACTIVE: 'bg-muted text-muted-foreground',
  ON_LEAVE: 'bg-amber-500/10 text-amber-600',
  SUSPENDED: 'bg-orange-500/10 text-orange-600',
  TERMINATED: 'bg-destructive/10 text-destructive',
};

export const EMPLOYMENT_TYPE_LABELS: Record<EmploymentType, string> = {
  FULL_TIME: 'Full-time',
  PART_TIME: 'Part-time',
  INTERN: 'Intern',
  CONTRACT: 'Contract',
};

export const GENDER_LABELS: Record<Gender, string> = {
  MALE: 'Male',
  FEMALE: 'Female',
  OTHER: 'Other',
  PREFER_NOT_TO_SAY: 'Prefer not to say',
};

export const MARITAL_STATUS_LABELS: Record<MaritalStatus, string> = {
  SINGLE: 'Single',
  MARRIED: 'Married',
  DIVORCED: 'Divorced',
  WIDOWED: 'Widowed',
  OTHER: 'Other',
};

export const DOCUMENT_TYPE_LABELS: Record<EmployeeDocumentType, string> = {
  AADHAAR: 'Aadhaar',
  PAN: 'PAN',
  DRIVING_LICENCE: 'Driving licence',
  OFFER_LETTER: 'Offer letter',
  APPOINTMENT_LETTER: 'Appointment letter',
  CERTIFICATE: 'Certificate',
  OTHER: 'Other',
};

/** Allowed document uploads (§255): PDF/PNG/JPG/JPEG, max 10 MB. */
export const DOCUMENT_MAX_BYTES = 10 * 1024 * 1024;
export const DOCUMENT_ALLOWED_MIME = [
  'application/pdf',
  'image/png',
  'image/jpeg',
] as const;
