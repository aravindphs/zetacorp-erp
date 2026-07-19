/**
 * Shared Zod schemas reused across every module (spec §62, §378).
 */
import { z } from 'zod';

/** UUID primary key. */
export const uuidSchema = z.string().uuid('Invalid identifier.');

/** A trimmed, non-empty string with a sensible max length. */
export const nonEmptyString = (max = 255) =>
  z
    .string()
    .trim()
    .min(1, 'This field is required.')
    .max(max, `Must be at most ${max} characters.`);

/** Optional trimmed string that normalises empty input to `undefined`. */
export const optionalString = (max = 255) =>
  z
    .string()
    .trim()
    .max(max, `Must be at most ${max} characters.`)
    .optional()
    .or(z.literal('').transform(() => undefined));

export const emailSchema = z.string().trim().toLowerCase().email('Enter a valid email address.');

/** Indian mobile/phone: 10–15 digits, optional leading +. */
export const phoneSchema = z
  .string()
  .trim()
  .regex(/^\+?[0-9]{10,15}$/, 'Enter a valid phone number.');

/** Indian GSTIN — 15 characters. */
export const gstSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z]{1}[1-9A-Z]{1}Z[0-9A-Z]{1}$/, 'Enter a valid GSTIN.');

/** Indian PAN — 10 characters. */
export const panSchema = z
  .string()
  .trim()
  .toUpperCase()
  .regex(/^[A-Z]{5}[0-9]{4}[A-Z]{1}$/, 'Enter a valid PAN.');

export const SORT_ORDERS = ['asc', 'desc'] as const;

/**
 * Query params for paginated list endpoints. Coerces string query values and
 * clamps page size to protect the database.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  search: z.string().trim().max(255).optional(),
  sortBy: z.string().trim().max(64).optional(),
  sortOrder: z.enum(SORT_ORDERS).default('desc'),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

/** Soft-delete reason, required when deleting critical records (spec §16). */
export const deleteReasonSchema = z.object({
  reason: nonEmptyString(500),
});
