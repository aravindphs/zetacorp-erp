/**
 * Employee validation (spec §250, §251, §259, §262). The server is
 * authoritative: employee code is generated, never accepted from the client.
 */
import { z } from 'zod';
import { EmploymentType, Gender, MaritalStatus, UserStatus } from '@prisma/client';
import {
  emailSchema,
  listQuerySchema,
  nonEmptyString,
  optionalString,
  phoneSchema,
  uuidSchema,
} from '@/schemas/common';

/** Password policy (§259): 12+ chars with upper, lower, number and symbol. */
export const passwordSchema = z
  .string()
  .min(12, 'Password must be at least 12 characters.')
  .regex(/[A-Z]/, 'Password must include an uppercase letter.')
  .regex(/[a-z]/, 'Password must include a lowercase letter.')
  .regex(/[0-9]/, 'Password must include a number.')
  .regex(/[^A-Za-z0-9]/, 'Password must include a special character.');

const optionalPhone = phoneSchema.optional().or(z.literal('').transform(() => undefined));
const optionalDate = z
  .string()
  .optional()
  .or(z.literal('').transform(() => undefined));

const employeeBase = z.object({
  // Personal (§250)
  firstName: nonEmptyString(80),
  lastName: optionalString(80),
  email: emailSchema,
  phone: optionalPhone,
  alternatePhone: optionalPhone,
  gender: z.nativeEnum(Gender).optional(),
  dateOfBirth: optionalDate,
  bloodGroup: optionalString(10),
  nationality: optionalString(60),
  maritalStatus: z.nativeEnum(MaritalStatus).optional(),
  emergencyContactName: optionalString(120),
  emergencyContactPhone: optionalPhone,
  addressLine1: optionalString(200),
  addressLine2: optionalString(200),
  city: optionalString(80),
  state: optionalString(80),
  postalCode: optionalString(20),

  // Employment (§251, §262 — department, joining date and role required)
  departmentId: uuidSchema,
  designationId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  roleId: uuidSchema,
  joiningDate: z.string().min(1, 'Joining date is required.'),
  reportingManagerId: z
    .string()
    .uuid()
    .optional()
    .or(z.literal('').transform(() => undefined)),
  employmentType: z.nativeEnum(EmploymentType).optional(),
  probationEndDate: optionalDate,
  workLocation: optionalString(120),
  status: z.nativeEnum(UserStatus).default('ACTIVE'),
});

export const createEmployeeSchema = employeeBase.extend({
  /** Initial Supabase Auth password (§259). */
  password: passwordSchema,
});

export const updateEmployeeSchema = employeeBase;

/** Reporting manager cannot reference the employee themselves (§262). */
export function assertNotSelfManager(employeeId: string, reportingManagerId?: string): boolean {
  return !reportingManagerId || reportingManagerId !== employeeId;
}

export const employeeListQuerySchema = listQuerySchema.extend({
  status: z.nativeEnum(UserStatus).optional(),
  departmentId: z.string().uuid().optional(),
  designationId: z.string().uuid().optional(),
  roleId: z.string().uuid().optional(),
  joinedFrom: z.string().trim().min(1).optional(),
  joinedTo: z.string().trim().min(1).optional(),
});

export const resetPasswordSchema = z.object({ password: passwordSchema });

export const changeRoleSchema = z.object({ roleId: uuidSchema });

export const changeStatusSchema = z.object({
  status: z.nativeEnum(UserStatus),
  reason: optionalString(500),
});

/**
 * Client-side form schema. Password is optional here because it only applies
 * when creating; the server re-validates with `createEmployeeSchema`, which
 * requires it (lenient client + strict server).
 */
export const employeeFormSchema = employeeBase.extend({
  password: passwordSchema.optional().or(z.literal('').transform(() => undefined)),
});

export type EmployeeFormInput = z.input<typeof employeeFormSchema>;
export type EmployeeFormOutput = z.output<typeof employeeFormSchema>;
export type CreateEmployeeInput = z.infer<typeof createEmployeeSchema>;
export type UpdateEmployeeInput = z.infer<typeof updateEmployeeSchema>;
export type EmployeeListQuery = z.infer<typeof employeeListQuerySchema>;
export type ChangeStatusInput = z.infer<typeof changeStatusSchema>;
