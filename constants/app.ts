/**
 * Application-wide constants. Module-specific enums live with their feature.
 */

export const APP_NAME = 'NSquare ERP';
export const COMPANY_NAME = 'NSquare Energies';

/** Auto-generated code prefixes (spec §25, §28, §30, §32, §34, §246, §297). */
export const CODE_PREFIX = {
  CUSTOMER: 'CUS',
  PRODUCT: 'PRD',
  QUOTATION: 'QT',
  INVOICE: 'INV',
  PAYMENT: 'PAY',
  EXPENSE: 'EXP',
  EMPLOYEE: 'EMP',
} as const;

export const PAGINATION = {
  DEFAULT_PAGE_SIZE: 20,
  MAX_PAGE_SIZE: 100,
} as const;

/** Secure file upload constraints (spec §71). */
export const UPLOAD = {
  MAX_SIZE_BYTES: 10 * 1024 * 1024, // 10 MB
  ALLOWED_MIME_TYPES: ['application/pdf', 'image/png', 'image/jpeg'] as const,
  ALLOWED_EXTENSIONS: ['pdf', 'png', 'jpg', 'jpeg'] as const,
  /** Signed URL lifetime in seconds. */
  SIGNED_URL_TTL: 60 * 60, // 1 hour
} as const;

/** Rate limits (spec §67). Window is in seconds. */
export const RATE_LIMIT = {
  LOGIN: { limit: 5, windowSeconds: 15 * 60 },
  PASSWORD_CHANGE: { limit: 10, windowSeconds: 60 * 60 },
  REPORT_EXPORT: { limit: 20, windowSeconds: 60 * 60 },
} as const;

/** GST rounding — invoices/quotations round to 2 decimals (paise). */
export const MONEY_DECIMALS = 2;
