/**
 * Invoice validation (spec §198, §199, §212). The server recomputes all money
 * from these inputs — client-sent totals are ignored.
 */
import { z } from 'zod';
import { PaymentMethod } from '@prisma/client';
import { listQuerySchema, nonEmptyString, optionalString, uuidSchema } from '@/schemas/common';

export const invoiceLineSchema = z.object({
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

export const createInvoiceSchema = z
  .object({
    customerId: uuidSchema,
    quotationId: z.string().uuid().optional(),
    invoiceDate: dateString,
    dueDate: z.string().optional().or(z.literal('').transform(() => undefined)),
    placeOfSupply: optionalString(100),
    referenceNumber: optionalString(100),
    reverseCharge: z.boolean().default(false),
    overallDiscount: z.coerce.number().min(0).default(0),
    notes: optionalString(4000),
    termsConditions: optionalString(2000),
    /** Itemized invoices carry product lines; contract billing does not. */
    items: z.array(invoiceLineSchema).default([]),
    /** Post immediately after creation (deduct stock). */
    postNow: z.boolean().default(false),

    // Contract billing (§ solar EPC). `contractValue` is GST-inclusive by
    // default and the taxable split is derived from it server-side.
    billingType: z.enum(['ITEMIZED', 'SPLIT', 'MATERIALS_ONLY']).default('SPLIT'),
    isTaxInclusive: z.boolean().default(true),
    contractValue: z.coerce.number().min(0).optional(),
    goodsRatio: z.coerce.number().min(0).max(100).default(70),
    goodsGstPercentage: z.coerce.number().min(0).max(28).default(5),
    serviceGstPercentage: z.coerce.number().min(0).max(28).default(18),
    goodsHsnCode: optionalString(20),
    serviceSacCode: optionalString(20),
    goodsDescription: optionalString(500),
    serviceDescription: optionalString(500),
    /** Bill-to address snapshot, pre-filled from the customer and editable. */
    billingAddress: optionalString(500),
  })
  .refine((v) => !v.dueDate || new Date(v.dueDate) >= new Date(v.invoiceDate), {
    message: 'Due date must be on or after the invoice date.',
    path: ['dueDate'],
  })
  .refine((v) => v.billingType !== 'ITEMIZED' || v.items.length > 0, {
    message: 'Add at least one product.',
    path: ['items'],
  })
  .refine(
    (v) => v.billingType === 'ITEMIZED' || (v.contractValue !== undefined && v.contractValue > 0),
    { message: 'Enter the agreed contract value.', path: ['contractValue'] },
  );

export const recordPaymentSchema = z.object({
  amount: z.coerce.number().positive('Amount must be greater than 0.'),
  paymentDate: dateString,
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: optionalString(100),
  remarks: optionalString(500),
});

export const invoiceListQuerySchema = listQuerySchema.extend({
  status: z.enum(['DRAFT', 'POSTED', 'CANCELLED']).optional(),
  paymentStatus: z.enum(['UNPAID', 'PARTIAL', 'PAID', 'OVERDUE']).optional(),
  customerId: z.string().uuid().optional(),
});

export const cancelInvoiceSchema = z.object({ reason: nonEmptyString(500) });

export type InvoiceLineInput = z.infer<typeof invoiceLineSchema>;
export type CreateInvoiceInput = z.infer<typeof createInvoiceSchema>;
export type RecordPaymentInput = z.infer<typeof recordPaymentSchema>;
export type InvoiceListQuery = z.infer<typeof invoiceListQuerySchema>;
