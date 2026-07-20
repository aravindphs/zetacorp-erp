/**
 * Department & designation validation (spec §252, §253). Both are
 * admin-managed catalogues that grow at runtime.
 */
import { z } from 'zod';
import { nonEmptyString, optionalString } from '@/schemas/common';

export const departmentSchema = z.object({
  name: nonEmptyString(100),
  description: optionalString(500),
  /** Optional department head (§252). */
  managerId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  isActive: z.boolean().default(true),
});

export const designationSchema = z.object({
  name: nonEmptyString(100),
  description: optionalString(500),
  isActive: z.boolean().default(true),
});

export type DepartmentInput = z.infer<typeof departmentSchema>;
export type DesignationInput = z.infer<typeof designationSchema>;
