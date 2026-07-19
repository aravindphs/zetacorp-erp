import { z } from 'zod';
import { nonEmptyString, optionalString } from '@/schemas/common';

export const categorySchema = z.object({
  name: nonEmptyString(100),
  description: optionalString(500),
  displayOrder: z.coerce.number().int().min(0).default(0),
  isActive: z.boolean().default(true),
});

export type CategoryInput = z.infer<typeof categorySchema>;
