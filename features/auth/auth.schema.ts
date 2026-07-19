/**
 * Auth validation schemas (spec §48, §378).
 */
import { z } from 'zod';
import { emailSchema } from '@/schemas/common';

export const loginSchema = z.object({
  email: emailSchema,
  password: z.string().min(1, 'Password is required.'),
});

export type LoginInput = z.infer<typeof loginSchema>;
