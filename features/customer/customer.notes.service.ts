import 'server-only';

/**
 * Customer notes (spec §121). Internal-only, authored, timestamped, and
 * soft-deleted. `updatedAt`/`updatedBy` provide basic edit history.
 */
import { prisma } from '@/lib/prisma';
import { auditCreate, softDelete } from '@/lib/db-helpers';
import { logActivity } from '@/services/activity-log.service';
import { NotFoundError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';

export async function listCustomerNotes(customerId: string) {
  const notes = await prisma.customerNote.findMany({
    where: { customerId, isDeleted: false },
    orderBy: { createdAt: 'desc' },
    select: { id: true, content: true, createdAt: true, updatedAt: true, createdBy: true },
  });

  const authorIds = [...new Set(notes.map((n) => n.createdBy).filter((v): v is string => Boolean(v)))];
  const authors = await prisma.user.findMany({
    where: { id: { in: authorIds } },
    select: { id: true, fullName: true },
  });
  const nameById = new Map(authors.map((a) => [a.id, a.fullName]));

  return notes.map((n) => ({
    id: n.id,
    content: n.content,
    author: n.createdBy ? (nameById.get(n.createdBy) ?? 'Unknown') : 'System',
    createdAt: n.createdAt.toISOString(),
    edited: n.updatedAt.getTime() - n.createdAt.getTime() > 1000,
  }));
}

export async function addCustomerNote(user: AuthUser, customerId: string, content: string) {
  const customer = await prisma.customer.findFirst({ where: { id: customerId, isDeleted: false }, select: { id: true } });
  if (!customer) throw new NotFoundError('Customer not found.');

  const note = await prisma.customerNote.create({
    data: { customerId, content, ...auditCreate(user.id) },
  });
  await logActivity({ userId: user.id, activity: 'Added a note', module: 'customer', referenceId: customerId });
  return note;
}

export async function deleteCustomerNote(user: AuthUser, noteId: string) {
  const note = await prisma.customerNote.findFirst({ where: { id: noteId, isDeleted: false } });
  if (!note) throw new NotFoundError('Note not found.');
  await prisma.customerNote.update({ where: { id: noteId }, data: { ...softDelete(user.id) } });
  await logActivity({ userId: user.id, activity: 'Deleted a note', module: 'customer', referenceId: note.customerId });
}
