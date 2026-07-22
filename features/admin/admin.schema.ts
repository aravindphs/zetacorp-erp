/**
 * System administration validation (spec §366).
 */
import { z } from 'zod';
import {
  emailSchema,
  gstSchema,
  nonEmptyString,
  optionalString,
  panSchema,
  uuidSchema,
} from '@/schemas/common';

const optionalGst = gstSchema.optional().or(z.literal('').transform(() => undefined));
const optionalPan = panSchema.optional().or(z.literal('').transform(() => undefined));
const optionalEmail = emailSchema.optional().or(z.literal('').transform(() => undefined));
const optionalUrl = z
  .string()
  .trim()
  .url('Enter a valid URL.')
  .optional()
  .or(z.literal('').transform(() => undefined));

/** Company profile (§349). */
export const companyProfileSchema = z.object({
  name: nonEmptyString(200),
  legalName: optionalString(200),
  gstNumber: optionalGst,
  panNumber: optionalPan,
  cin: optionalString(30),
  address: optionalString(500),
  city: optionalString(80),
  state: optionalString(80),
  country: optionalString(80),
  postalCode: optionalString(20),
  phone: optionalString(20),
  email: optionalEmail,
  website: optionalUrl,
  signatoryName: optionalString(120),
});

/** Financial + regional configuration (§350). */
export const financialConfigSchema = z.object({
  financialYearStart: optionalString(10),
  currency: optionalString(10),
  currencySymbol: optionalString(5),
  decimalPrecision: z.coerce.number().int().min(0).max(4).default(2),
  timezone: optionalString(64),
  dateFormat: optionalString(32),
});

/** GST defaults (§351). */
export const gstSettingsSchema = z.object({
  defaultGstin: optionalGst,
  defaultPlaceOfSupply: optionalString(100),
  reverseChargeDefault: z.boolean().default(false),
  defaultGstPercentage: z.coerce.number().min(0).max(28).default(18),
});

/** Security policy (§357). */
export const securitySettingsSchema = z.object({
  passwordMinLength: z.coerce.number().int().min(8).max(64).default(12),
  requireStrongPasswords: z.boolean().default(true),
  sessionTimeoutMinutes: z.coerce.number().int().min(5).max(1440).default(60),
  maxLoginAttempts: z.coerce.number().int().min(3).max(20).default(5),
  accountLockMinutes: z.coerce.number().int().min(1).max(1440).default(15),
});

/** Workspace preferences (§363). */
export const preferencesSchema = z.object({
  defaultLandingPage: optionalString(120),
  itemsPerPage: z.coerce.number().int().min(10).max(100).default(20),
  systemNotifications: z.boolean().default(true),
});

/** Roles (§353) — names must be unique (§366). */
export const roleSchema = z.object({
  name: nonEmptyString(60),
  description: optionalString(300),
  level: z.coerce.number().int().min(0).max(100).default(10),
});

/** Bulk permission assignment (§354). */
export const rolePermissionsSchema = z.object({
  permissionIds: z.array(uuidSchema),
});

/** Numbering sequences (§352). */
export const numberSequenceSchema = z.object({
  key: nonEmptyString(64),
  prefix: nonEmptyString(20),
  padding: z.coerce.number().int().min(1).max(12).default(6),
  nextValue: z.coerce.number().int().min(1).default(1),
});

const logQueryBase = {
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(50),
  userId: z.string().uuid().optional(),
  module: z.string().trim().max(50).optional(),
  fromDate: z.string().trim().min(1).optional(),
  toDate: z.string().trim().min(1).optional(),
};

export const activityLogQuerySchema = z.object({
  ...logQueryBase,
  search: z.string().trim().max(200).optional(),
});

export const auditLogQuerySchema = z.object({
  ...logQueryBase,
  action: z.string().trim().max(50).optional(),
});

export const backupSchema = z.object({
  backupName: optionalString(120),
  /** Guards an irreversible operation (§366). */
  confirm: z.literal(true, { message: 'Confirmation is required.' }),
});

export type CompanyProfileInput = z.infer<typeof companyProfileSchema>;
export type FinancialConfigInput = z.infer<typeof financialConfigSchema>;
export type GstSettingsInput = z.infer<typeof gstSettingsSchema>;
export type SecuritySettingsInput = z.infer<typeof securitySettingsSchema>;
export type PreferencesInput = z.infer<typeof preferencesSchema>;
export type RoleInput = z.infer<typeof roleSchema>;
export type NumberSequenceInput = z.infer<typeof numberSequenceSchema>;
export type ActivityLogQuery = z.infer<typeof activityLogQuerySchema>;
export type AuditLogQuery = z.infer<typeof auditLogQuerySchema>;
