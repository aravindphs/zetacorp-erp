/**
 * Leave validation (spec §278, §286). The server recomputes duration and
 * re-checks overlaps — client values are never trusted.
 */
import { z } from 'zod';
import { LeaveStatus } from '@prisma/client';
import { listQuerySchema, nonEmptyString, optionalString, uuidSchema } from '@/schemas/common';

const dateString = z.string().min(1, 'Required.');

export const applyLeaveSchema = z
  .object({
    leaveTypeId: uuidSchema,
    fromDate: dateString,
    toDate: dateString,
    isHalfDay: z.boolean().default(false),
    reason: nonEmptyString(1000),
    emergencyContact: optionalString(120),
    delegateEmployeeId: z
      .string()
      .uuid()
      .optional()
      .or(z.literal('').transform(() => undefined)),
    /** Submit for approval immediately instead of saving a draft (§277). */
    submit: z.boolean().default(true),
  })
  .refine((v) => new Date(v.toDate) >= new Date(v.fromDate), {
    message: 'End date must be on or after the start date.',
    path: ['toDate'],
  })
  .refine((v) => !v.isHalfDay || v.fromDate === v.toDate, {
    message: 'A half day must start and end on the same date.',
    path: ['isHalfDay'],
  });

export const updateLeaveSchema = applyLeaveSchema;

export const leaveListQuerySchema = listQuerySchema.extend({
  status: z.nativeEnum(LeaveStatus).optional(),
  leaveTypeId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
  departmentId: z.string().uuid().optional(),
  fromDate: z.string().trim().min(1).optional(),
  toDate: z.string().trim().min(1).optional(),
  /** Restrict to the signed-in user's own requests ("My Leave", §276). */
  mine: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => v === true || v === 'true'),
});

export const leaveDecisionSchema = z.object({
  remarks: optionalString(1000),
});

export const cancelLeaveSchema = z.object({
  reason: optionalString(500),
});

export const leaveCalendarQuerySchema = z.object({
  month: z.coerce.number().int().min(1).max(12).optional(),
  year: z.coerce.number().int().min(2000).max(2100).optional(),
  departmentId: z.string().uuid().optional(),
  leaveTypeId: z.string().uuid().optional(),
  employeeId: z.string().uuid().optional(),
});

export type ApplyLeaveInput = z.infer<typeof applyLeaveSchema>;
export type LeaveListQuery = z.infer<typeof leaveListQuerySchema>;
export type LeaveCalendarQuery = z.infer<typeof leaveCalendarQuerySchema>;
export type ApplyLeaveFormInput = z.input<typeof applyLeaveSchema>;
export type ApplyLeaveFormOutput = z.output<typeof applyLeaveSchema>;
