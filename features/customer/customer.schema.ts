/**
 * Customer validation schemas (spec §110, §111). Used by both the client form
 * (React Hook Form) and the server (re-validated — never trust the client).
 */
import { z } from 'zod';
import { AddressType, ContactMethod, CustomerStatus, CustomerType } from '@prisma/client';
import {
  emailSchema,
  gstSchema,
  listQuerySchema,
  nonEmptyString,
  optionalString,
  panSchema,
  phoneSchema,
} from '@/schemas/common';

const optionalEmail = emailSchema.optional().or(z.literal('').transform(() => undefined));
const optionalPhone = phoneSchema.optional().or(z.literal('').transform(() => undefined));
const optionalGst = gstSchema.optional().or(z.literal('').transform(() => undefined));
const optionalPan = panSchema.optional().or(z.literal('').transform(() => undefined));
const optionalUrl = z
  .string()
  .trim()
  .url('Enter a valid URL.')
  .optional()
  .or(z.literal('').transform(() => undefined));
const postalCode = z
  .string()
  .trim()
  .regex(/^[0-9]{6}$/, 'Enter a valid 6-digit postal code.');

export const addressSchema = z.object({
  addressType: z.nativeEnum(AddressType),
  addressLine1: nonEmptyString(255),
  addressLine2: optionalString(255),
  city: nonEmptyString(100),
  district: optionalString(100),
  state: nonEmptyString(100),
  country: nonEmptyString(100).default('India'),
  postalCode,
  isDefault: z.boolean().default(false),
});

const customerBase = z.object({
  customerType: z.nativeEnum(CustomerType).default(CustomerType.INDIVIDUAL),
  companyName: optionalString(200),
  customerName: nonEmptyString(150),
  phone: phoneSchema,
  alternatePhone: optionalPhone,
  email: optionalEmail,
  website: optionalUrl,
  gstNumber: optionalGst,
  panNumber: optionalPan,
  aadhaarNumber: z
    .string()
    .trim()
    .regex(/^[0-9]{12}$/, 'Aadhaar must be 12 digits.')
    .optional()
    .or(z.literal('').transform(() => undefined)),
  notes: optionalString(2000),
  // Business information
  industry: optionalString(100),
  businessSize: optionalString(50),
  paymentTermsDays: z.coerce.number().int().min(0).max(365).optional(),
  creditLimit: z.coerce.number().min(0).default(0),
  preferredContactMethod: z.nativeEnum(ContactMethod).optional(),
});

export const createCustomerSchema = customerBase
  .extend({
    billingAddress: addressSchema.optional(),
    shippingAddress: addressSchema.optional(),
    useSameForShipping: z.boolean().default(false),
    /** Admins may override duplicate warnings (spec §124). */
    overrideDuplicates: z.boolean().default(false),
  })
  .refine((v) => v.customerType === CustomerType.INDIVIDUAL || Boolean(v.companyName), {
    message: 'Company name is required for non-individual customers.',
    path: ['companyName'],
  });

export const updateCustomerSchema = customerBase.extend({
  status: z.nativeEnum(CustomerStatus).optional(),
  overrideDuplicates: z.boolean().default(false),
});

/** List query with customer-specific filters (spec §106). */
export const customerListQuerySchema = listQuerySchema.extend({
  status: z.nativeEnum(CustomerStatus).optional(),
  customerType: z.nativeEnum(CustomerType).optional(),
  city: z.string().trim().max(100).optional(),
  gstRegistered: z.enum(['yes', 'no']).optional(),
});

export const customerNoteSchema = z.object({
  content: nonEmptyString(2000),
});

/** Lenient address for the client form: every field allows empty input. When
 *  an address is actually filled in, the server re-validates it strictly with
 *  `addressSchema`. Keeps an untouched (blank) address from blocking submit. */
const formAddressSchema = z.object({
  addressLine1: z.string().optional(),
  addressLine2: z.string().optional(),
  city: z.string().optional(),
  district: z.string().optional(),
  state: z.string().optional(),
  country: z.string().optional(),
  postalCode: z.string().optional(),
});

/** Superset schema used by the client form; the server re-validates with the
 *  strict create/update schemas. Addresses are optional at creation and can be
 *  managed later from the Addresses tab (spec §116). */
export const customerFormSchema = customerBase.extend({
  status: z.nativeEnum(CustomerStatus).optional(),
  billingAddress: formAddressSchema.optional(),
  shippingAddress: formAddressSchema.optional(),
  useSameForShipping: z.boolean().default(true),
});

export type CustomerFormInput = z.input<typeof customerFormSchema>;
export type CustomerFormValues = z.output<typeof customerFormSchema>;
export type CreateCustomerInput = z.infer<typeof createCustomerSchema>;
export type UpdateCustomerInput = z.infer<typeof updateCustomerSchema>;
export type CustomerListQuery = z.infer<typeof customerListQuerySchema>;
export type AddressInput = z.infer<typeof addressSchema>;
export type CustomerNoteInput = z.infer<typeof customerNoteSchema>;
