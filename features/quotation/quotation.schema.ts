/**
 * Quotation validation (spec §169–§173, §184). Same line/pricing shape as
 * invoices (shared calc engine), but quotations never touch stock or payments.
 */
import { z } from 'zod';
import { listQuerySchema, nonEmptyString, optionalString, uuidSchema } from '@/schemas/common';

export const quotationLineSchema = z.object({
  productId: z.string().uuid().optional(),
  productName: nonEmptyString(200),
  description: optionalString(500),
  hsnCode: optionalString(20),
  unit: nonEmptyString(20).default('Nos'),
  quantity: z.coerce.number().positive('Quantity must be greater than 0.'),
  unitPrice: z.coerce.number().min(0, 'Price must be 0 or more.'),
  discount: z.coerce.number().min(0).default(0),
  gstPercentage: z.coerce.number().min(0).max(28).default(0),
});

const dateString = z.string().min(1, 'Required.');

export const createQuotationSchema = z
  .object({
    customerId: uuidSchema,
    quotationDate: dateString,
    validUntil: z.string().optional().or(z.literal('').transform(() => undefined)),
    placeOfSupply: optionalString(100),
    referenceNumber: optionalString(100),
    overallDiscount: z.coerce.number().min(0).default(0),
    remarks: optionalString(2000),
    termsConditions: optionalString(2000),
    items: z.array(quotationLineSchema).min(1, 'Add at least one item.'),
  })
  .refine(
    (v) => !v.validUntil || new Date(v.validUntil) >= new Date(v.quotationDate),
    { message: 'Validity date must be on or after the quotation date.', path: ['validUntil'] },
  );

export const quotationStatusSchema = z.object({
  status: z.enum(['SENT', 'ACCEPTED', 'REJECTED']),
});

export const cancelQuotationSchema = z.object({ reason: nonEmptyString(500) });

export const quotationListQuerySchema = listQuerySchema.extend({
  status: z.enum(['DRAFT', 'SENT', 'ACCEPTED', 'REJECTED', 'EXPIRED', 'CANCELLED']).optional(),
  customerId: z.string().uuid().optional(),
});

export type CreateQuotationInput = z.infer<typeof createQuotationSchema>;
export type QuotationListQuery = z.infer<typeof quotationListQuerySchema>;
