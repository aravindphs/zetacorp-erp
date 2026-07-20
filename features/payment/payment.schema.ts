/**
 * Payment validation & list querying (spec §223, §227). Recording a payment
 * reuses `recordPaymentSchema` from the invoice module — the same server
 * routine owns the invoice-balance recomputation.
 */
import { z } from 'zod';
import { PaymentMethod, PaymentStatus } from '@prisma/client';
import { listQuerySchema } from '@/schemas/common';

export const paymentListQuerySchema = listQuerySchema.extend({
  status: z.nativeEnum(PaymentStatus).optional(),
  method: z.nativeEnum(PaymentMethod).optional(),
  customerId: z.string().uuid().optional(),
  dateFrom: z.string().trim().min(1).optional(),
  dateTo: z.string().trim().min(1).optional(),
});

export type PaymentListQuery = z.infer<typeof paymentListQuerySchema>;
