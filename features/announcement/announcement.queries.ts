import 'server-only';

/**
 * Announcement read models (spec §37). Lists are paginated and ordered on
 * indexed columns; the "active for me" feed is filtered in SQL.
 */
import { Prisma, type AnnouncementPriority } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import type { AnnouncementListQuery } from '@/features/announcement/announcement.schema';
import type { AuthUser } from '@/types/auth';

export interface AnnouncementRow {
  id: string;
  title: string;
  description: string;
  priority: AnnouncementPriority;
  publishDate: string | null;
  expiryDate: string | null;
  isPublished: boolean;
  visibleRoles: string[];
  createdAt: string;
  authorName: string;
  /** How many targeted users have acknowledged it. */
  acknowledgedCount: number;
}

async function namesByUserId(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

export async function getAnnouncementList(query: AnnouncementListQuery) {
  const where: Prisma.AnnouncementWhereInput = { isDeleted: false };
  if (query.priority) where.priority = query.priority;
  if (query.published !== undefined) where.isPublished = query.published;
  if (query.search) {
    const contains = { contains: query.search, mode: Prisma.QueryMode.insensitive };
    where.OR = [{ title: contains }, { description: contains }];
  }

  const [items, total] = await Promise.all([
    prisma.announcement.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        title: true,
        description: true,
        priority: true,
        publishDate: true,
        expiryDate: true,
        isPublished: true,
        visibleRoles: true,
        createdAt: true,
        createdBy: true,
        _count: { select: { acknowledgements: true } },
      },
    }),
    prisma.announcement.count({ where }),
  ]);

  const nameById = await namesByUserId(items.map((a) => a.createdBy));

  const rows: AnnouncementRow[] = items.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    priority: a.priority,
    publishDate: a.publishDate?.toISOString() ?? null,
    expiryDate: a.expiryDate?.toISOString() ?? null,
    isPublished: a.isPublished,
    visibleRoles: a.visibleRoles,
    createdAt: a.createdAt.toISOString(),
    authorName: a.createdBy ? (nameById.get(a.createdBy) ?? 'System') : 'System',
    acknowledgedCount: a._count.acknowledgements,
  }));

  return { rows, meta: buildPaginationMeta(query, total) };
}

export function getAnnouncementDetail(id: string) {
  return prisma.announcement.findFirst({ where: { id, isDeleted: false } });
}

/**
 * Published announcements this user has not yet acknowledged. Drives the
 * blocking acknowledgement prompt, so it must stay cheap: one indexed query
 * with the "already acknowledged" set excluded in SQL.
 */
export async function getPendingAcknowledgements(user: AuthUser) {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      isDeleted: false,
      isPublished: true,
      AND: [
        { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
        { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
        { OR: [{ visibleRoles: { isEmpty: true } }, { visibleRoles: { has: user.roleName } }] },
        { acknowledgements: { none: { userId: user.id } } },
      ],
    },
    orderBy: [{ priority: 'desc' }, { publishDate: 'asc' }],
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      publishDate: true,
    },
  });

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    priority: a.priority,
    publishDate: a.publishDate?.toISOString() ?? null,
  }));
}

/**
 * Announcements currently visible to this user: published, inside their
 * publish/expiry window, and either public or targeted at their role.
 */
export async function getActiveAnnouncements(user: AuthUser, limit = 5) {
  const now = new Date();
  const rows = await prisma.announcement.findMany({
    where: {
      isDeleted: false,
      isPublished: true,
      AND: [
        { OR: [{ publishDate: null }, { publishDate: { lte: now } }] },
        { OR: [{ expiryDate: null }, { expiryDate: { gte: now } }] },
        { OR: [{ visibleRoles: { isEmpty: true } }, { visibleRoles: { has: user.roleName } }] },
      ],
    },
    orderBy: [{ priority: 'desc' }, { publishDate: 'desc' }],
    take: limit,
    select: {
      id: true,
      title: true,
      description: true,
      priority: true,
      publishDate: true,
    },
  });

  return rows.map((a) => ({
    id: a.id,
    title: a.title,
    description: a.description,
    priority: a.priority,
    publishDate: a.publishDate?.toISOString() ?? null,
  }));
}
