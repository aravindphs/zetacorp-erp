import 'server-only';

/**
 * Announcement business logic (spec §37). Soft delete only; publishing is a
 * separate permission so authors can draft without broadcasting.
 */
import { prisma } from '@/lib/prisma';
import { auditCreate, auditUpdate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { logAudit } from '@/services/audit-log.service';
import { NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';
import type { AnnouncementInput } from '@/features/announcement/announcement.schema';

function toDate(value?: string): Date | null {
  return value ? new Date(value) : null;
}

function data(input: AnnouncementInput) {
  return {
    title: input.title,
    description: input.description,
    priority: input.priority,
    publishDate: toDate(input.publishDate),
    expiryDate: toDate(input.expiryDate),
    isPublished: input.isPublished,
    visibleRoles: input.visibleRoles,
  };
}

export async function createAnnouncement(user: AuthUser, input: AnnouncementInput) {
  const announcement = await prisma.announcement.create({
    data: {
      ...data(input),
      // Publishing without an explicit date starts it immediately.
      publishDate: toDate(input.publishDate) ?? (input.isPublished ? new Date() : null),
      ...auditCreate(user.id),
    },
  });

  await logActivity({
    userId: user.id,
    activity: `Created announcement "${announcement.title}"`,
    module: 'announcement',
    referenceId: announcement.id,
  });
  return announcement;
}

export async function updateAnnouncement(user: AuthUser, id: string, input: AnnouncementInput) {
  const existing = await prisma.announcement.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, title: true, isPublished: true },
  });
  if (!existing) throw new NotFoundError('Announcement not found.');

  const announcement = await prisma.announcement.update({
    where: { id },
    data: {
      ...data(input),
      publishDate:
        toDate(input.publishDate) ??
        (input.isPublished && !existing.isPublished ? new Date() : null),
      ...auditUpdate(user.id),
    },
  });

  await logActivity({
    userId: user.id,
    activity: `Updated announcement "${announcement.title}"`,
    module: 'announcement',
    referenceId: id,
  });
  return announcement;
}

/** Publish or unpublish without touching the content (§37). */
export async function setAnnouncementPublished(user: AuthUser, id: string, published: boolean) {
  const existing = await prisma.announcement.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, title: true, publishDate: true },
  });
  if (!existing) throw new NotFoundError('Announcement not found.');

  await prisma.announcement.update({
    where: { id },
    data: {
      isPublished: published,
      publishDate: published ? (existing.publishDate ?? new Date()) : existing.publishDate,
      ...auditUpdate(user.id),
    },
  });

  await logActivity({
    userId: user.id,
    activity: `${published ? 'Published' : 'Unpublished'} announcement "${existing.title}"`,
    module: 'announcement',
    referenceId: id,
  });
}

/**
 * Record that a user has acknowledged an announcement. Idempotent: a repeated
 * submit (double-click, retry) must not fail or duplicate the audit trail.
 */
export async function acknowledgeAnnouncement(user: AuthUser, id: string) {
  const announcement = await prisma.announcement.findFirst({
    where: { id, isDeleted: false, isPublished: true },
    select: { id: true, title: true },
  });
  if (!announcement) throw new NotFoundError('Announcement not found.');

  const created = await prisma.announcementAcknowledgement.upsert({
    where: { announcementId_userId: { announcementId: id, userId: user.id } },
    update: {},
    create: { announcementId: id, userId: user.id },
    select: { acknowledgedAt: true },
  });

  await logActivity({
    userId: user.id,
    activity: `Acknowledged announcement "${announcement.title}"`,
    module: 'announcement',
    referenceId: id,
  });
  return created;
}

export async function deleteAnnouncement(user: AuthUser, id: string) {
  const existing = await prisma.announcement.findFirst({
    where: { id, isDeleted: false },
    select: { id: true, title: true },
  });
  if (!existing) throw new NotFoundError('Announcement not found.');

  await prisma.$transaction(async (tx) => {
    await tx.announcement.update({ where: { id }, data: { ...softDelete(user.id) } });
    await logAudit(
      {
        userId: user.id,
        action: 'DELETE',
        module: 'announcement',
        referenceId: id,
        oldValue: { title: existing.title },
      },
      tx,
    );
  });

  await logActivity({
    userId: user.id,
    activity: `Deleted announcement "${existing.title}"`,
    module: 'announcement',
    referenceId: id,
  });
}
