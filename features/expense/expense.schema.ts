/**
 * Expense validation (spec §304, §310). Amount and dates are re-validated
 * server-side; the receipt-required and future-date rules are configurable.
 */
import { z } from 'zod';
import { ExpenseStatus, PaymentMethod } from '@prisma/client';
import { listQuerySchema, nonEmptyString, optionalString, uuidSchema } from '@/schemas/common';

const dateString = z.string().min(1, 'Required.');

export const submitExpenseSchema = z.object({
  expenseCategoryId: uuidSchema,
  expenseDate: dateString,
  amount: z.coerce.number().positive('Amount must be greater than 0.'),
  currency: nonEmptyString(3).default('INR'),
  description: optionalString(1000),
  vendorName: optionalString(200),
  referenceNumber: optionalString(100),
  remarks: optionalString(1000),
  /** Submit for approval immediately instead of saving a draft (§303). */
  submit: z.boolean().default(true),
});

export const updateExpenseSchema = submitExpenseSchema;

export const expenseListQuerySchema = listQuerySchema.extend({
  status: z.nativeEnum(ExpenseStatus).optional(),
  expenseCategoryId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  fromDate: z.string().trim().min(1).optional(),
  toDate: z.string().trim().min(1).optional(),
  minAmount: z.coerce.number().min(0).optional(),
  maxAmount: z.coerce.number().min(0).optional(),
  /** Restrict to the signed-in user's own claims ("My Expenses", §302). */
  mine: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === true || v === 'true'),
  /** Only claims awaiting this user's approval (§296 Pending Approvals). */
  pendingMine: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const expenseDecisionSchema = z.object({ remarks: optionalString(1000) });

export const cancelExpenseSchema = z.object({ reason: optionalString(500) });

/** Finance reimbursement details (§308). */
export const reimburseExpenseSchema = z.object({
  paymentDate: dateString,
  paymentMethod: z.nativeEnum(PaymentMethod),
  referenceNumber: optionalString(100),
  remarks: optionalString(500),
});

export type SubmitExpenseInput = z.infer<typeof submitExpenseSchema>;
export type ExpenseListQuery = z.infer<typeof expenseListQuerySchema>;
export type ReimburseExpenseInput = z.infer<typeof reimburseExpenseSchema>;
export type ExpenseFormInput = z.input<typeof submitExpenseSchema>;
export type ExpenseFormOutput = z.output<typeof submitExpenseSchema>;
