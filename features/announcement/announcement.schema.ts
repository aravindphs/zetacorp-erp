/**
 * Announcement validation (spec §37). Visibility is by role name; an empty
 * list means everyone can see it.
 */
import { z } from 'zod';
import { AnnouncementPriority } from '@prisma/client';
import { listQuerySchema, nonEmptyString, optionalString } from '@/schemas/common';

const optionalDate = z
  .string()
  .optional()
  .or(z.literal('').transform(() => undefined));

export const announcementSchema = z
  .object({
    title: nonEmptyString(200),
    description: nonEmptyString(4000),
    priority: z.nativeEnum(AnnouncementPriority).default('MEDIUM'),
    publishDate: optionalDate,
    expiryDate: optionalDate,
    isPublished: z.boolean().default(false),
    /** Role names allowed to see this; empty = visible to all. */
    visibleRoles: z.array(nonEmptyString(60)).default([]),
  })
  .refine(
    (v) => !v.publishDate || !v.expiryDate || new Date(v.expiryDate) >= new Date(v.publishDate),
    { message: 'Expiry must be on or after the publish date.', path: ['expiryDate'] },
  );

export const announcementListQuerySchema = listQuerySchema.extend({
  priority: z.nativeEnum(AnnouncementPriority).optional(),
  published: z
    .union([z.boolean(), z.literal('true'), z.literal('false')])
    .optional()
    .transform((v) => (v === undefined ? undefined : v === true || v === 'true')),
});

export const cancelAnnouncementSchema = z.object({ reason: optionalString(500) });

export type AnnouncementInput = z.infer<typeof announcementSchema>;
export type AnnouncementListQuery = z.infer<typeof announcementListQuerySchema>;
