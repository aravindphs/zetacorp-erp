import 'server-only';

/**
 * System administration read models (spec §349–§364).
 *
 * Performance rules for this file (§364 wants sub-300ms):
 *  • logs are always paginated and ordered on an indexed column;
 *  • the permission catalogue is tiny and near-static, so it is cached;
 *  • independent reads go through `Promise.all`;
 *  • system health uses counts/aggregates, never table scans.
 */
import { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { buildPaginationMeta } from '@/lib/pagination';
import { getSettingsMap } from '@/features/settings/settings.cache';
import type { ActivityLogQuery, AuditLogQuery } from '@/features/admin/admin.schema';

// --- Settings (§349, §350, §351, §363) ------------------------------------

export interface SettingRow {
  settingKey: string;
  settingValue: unknown;
  category: string;
  description: string | null;
  isPublic: boolean;
}

/** All settings grouped by category — one query, request-cached upstream. */
export async function getSettingsByCategory(): Promise<Record<string, SettingRow[]>> {
  const rows = await prisma.systemSetting.findMany({
    orderBy: [{ category: 'asc' }, { settingKey: 'asc' }],
    select: {
      settingKey: true,
      settingValue: true,
      category: true,
      description: true,
      isPublic: true,
    },
  });

  const grouped: Record<string, SettingRow[]> = {};
  for (const row of rows) {
    (grouped[row.category] ??= []).push(row as SettingRow);
  }
  return grouped;
}

/** Read a specific set of keys without re-querying (uses the request cache). */
export async function getSettingValues(keys: string[]): Promise<Record<string, unknown>> {
  const map = await getSettingsMap();
  return Object.fromEntries(keys.map((k) => [k, map.get(k) ?? null]));
}

// --- Roles & permissions (§353, §354) --------------------------------------

export interface RoleRow {
  id: string;
  name: string;
  description: string | null;
  isSystemRole: boolean;
  level: number;
  permissionCount: number;
  userCount: number;
}

export async function getRoles(): Promise<RoleRow[]> {
  const roles = await prisma.role.findMany({
    where: { isDeleted: false },
    orderBy: { level: 'desc' },
    select: {
      id: true,
      name: true,
      description: true,
      isSystemRole: true,
      level: true,
      _count: {
        select: {
          rolePermissions: true,
          users: { where: { isDeleted: false } },
        },
      },
    },
  });

  return roles.map((r) => ({
    id: r.id,
    name: r.name,
    description: r.description,
    isSystemRole: r.isSystemRole,
    level: r.level,
    permissionCount: r._count.rolePermissions,
    userCount: r._count.users,
  }));
}

export interface PermissionGroup {
  module: string;
  permissions: { id: string; key: string; action: string; description: string | null }[];
}

/**
 * The permission catalogue is ~100 near-immutable rows read on every roles
 * screen, so it is cached process-wide rather than re-queried.
 */
const CATALOGUE_TTL_MS = 5 * 60_000;
let catalogueCache: { groups: PermissionGroup[]; expiresAt: number } | null = null;

export async function getPermissionCatalogue(): Promise<PermissionGroup[]> {
  if (catalogueCache && catalogueCache.expiresAt > Date.now()) return catalogueCache.groups;

  const permissions = await prisma.permission.findMany({
    orderBy: [{ module: 'asc' }, { action: 'asc' }],
    select: { id: true, key: true, module: true, action: true, description: true },
  });

  const byModule = new Map<string, PermissionGroup>();
  for (const p of permissions) {
    const group = byModule.get(p.module) ?? { module: p.module, permissions: [] };
    group.permissions.push({
      id: p.id,
      key: p.key,
      action: p.action,
      description: p.description,
    });
    byModule.set(p.module, group);
  }

  const groups = [...byModule.values()];
  catalogueCache = { groups, expiresAt: Date.now() + CATALOGUE_TTL_MS };
  return groups;
}

export function invalidatePermissionCatalogue(): void {
  catalogueCache = null;
}

/** Permission ids currently granted to a role (ids only — no join payload). */
export async function getRolePermissionIds(roleId: string): Promise<string[]> {
  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permissionId: true },
  });
  return rows.map((r) => r.permissionId);
}

// --- Logs (§360, §361) -----------------------------------------------------

/** Resolve actor ids to names in one query (audit columns are scalar UUIDs). */
async function namesByUserId(ids: (string | null)[]): Promise<Map<string, string>> {
  const unique = [...new Set(ids.filter((v): v is string => Boolean(v)))];
  if (unique.length === 0) return new Map();
  const users = await prisma.user.findMany({
    where: { id: { in: unique } },
    select: { id: true, fullName: true },
  });
  return new Map(users.map((u) => [u.id, u.fullName]));
}

export async function getActivityLogs(query: ActivityLogQuery) {
  const where: Prisma.ActivityLogWhereInput = {};
  if (query.userId) where.userId = query.userId;
  if (query.module) where.module = query.module;
  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(`${query.toDate}T23:59:59.999`);
  }
  if (query.search) {
    where.activity = { contains: query.search, mode: Prisma.QueryMode.insensitive };
  }

  const [rows, total] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        activity: true,
        module: true,
        userId: true,
        ipAddress: true,
        browser: true,
        createdAt: true,
      },
    }),
    prisma.activityLog.count({ where }),
  ]);

  const nameById = await namesByUserId(rows.map((r) => r.userId));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      activity: r.activity,
      module: r.module,
      userName: r.userId ? (nameById.get(r.userId) ?? 'System') : 'System',
      ipAddress: r.ipAddress,
      browser: r.browser,
      createdAt: r.createdAt.toISOString(),
    })),
    meta: buildPaginationMeta(query, total),
  };
}

export async function getAuditLogs(query: AuditLogQuery) {
  const where: Prisma.AuditLogWhereInput = {};
  if (query.userId) where.userId = query.userId;
  if (query.module) where.module = query.module;
  if (query.action) where.action = query.action;
  if (query.fromDate || query.toDate) {
    where.createdAt = {};
    if (query.fromDate) where.createdAt.gte = new Date(query.fromDate);
    if (query.toDate) where.createdAt.lte = new Date(`${query.toDate}T23:59:59.999`);
  }

  const [rows, total] = await Promise.all([
    prisma.auditLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (query.page - 1) * query.pageSize,
      take: query.pageSize,
      select: {
        id: true,
        action: true,
        module: true,
        referenceId: true,
        // `oldValue` is deliberately not selected: the list only renders the
        // new value, and shipping both JSON blobs for 50 rows doubled the
        // query time. The detail payload stays available via the audit API.
        newValue: true,
        userId: true,
        createdAt: true,
      },
    }),
    prisma.auditLog.count({ where }),
  ]);

  const nameById = await namesByUserId(rows.map((r) => r.userId));

  return {
    rows: rows.map((r) => ({
      id: r.id,
      action: r.action,
      module: r.module,
      referenceId: r.referenceId,
      newValue: r.newValue,
      userName: r.userId ? (nameById.get(r.userId) ?? 'System') : 'System',
      createdAt: r.createdAt.toISOString(),
    })),
    meta: buildPaginationMeta(query, total),
  };
}

/** Distinct module names for the log filters — small and cacheable. */
const MODULES_TTL_MS = 5 * 60_000;
let moduleCache: { modules: string[]; expiresAt: number } | null = null;

export async function getLogModules(): Promise<string[]> {
  if (moduleCache && moduleCache.expiresAt > Date.now()) return moduleCache.modules;
  const rows = await prisma.permission.findMany({
    distinct: ['module'],
    orderBy: { module: 'asc' },
    select: { module: true },
  });
  const modules = rows.map((r) => r.module);
  moduleCache = { modules, expiresAt: Date.now() + MODULES_TTL_MS };
  return modules;
}

// --- Numbering (§352) ------------------------------------------------------

export async function getNumberSequences() {
  return prisma.numberSequence.findMany({
    orderBy: { key: 'asc' },
    select: { key: true, prefix: true, padding: true, nextValue: true },
  });
}

// --- Backups (§358) --------------------------------------------------------

export async function getBackupHistory(limit = 20) {
  const rows = await prisma.backupHistory.findMany({
    orderBy: { createdAt: 'desc' },
    take: limit,
    select: {
      id: true,
      backupName: true,
      backupType: true,
      fileSize: true,
      status: true,
      storageLocation: true,
      createdAt: true,
      createdBy: true,
    },
  });

  const nameById = await namesByUserId(rows.map((r) => r.createdBy));
  return rows.map((r) => ({
    id: r.id,
    backupName: r.backupName,
    backupType: r.backupType,
    // BigInt is not JSON-serialisable across the RSC boundary.
    fileSize: r.fileSize === null ? null : Number(r.fileSize),
    status: r.status,
    storageLocation: r.storageLocation,
    createdAt: r.createdAt.toISOString(),
    createdByName: r.createdBy ? (nameById.get(r.createdBy) ?? 'System') : 'System',
  }));
}

// --- System health (§362) --------------------------------------------------

export async function getSystemHealth() {
  const startedAt = Date.now();
  const dayAgo = new Date(Date.now() - 24 * 60 * 60 * 1000);

  // Every counter comes back in ONE round-trip via sub-selects. Issuing them
  // as six separate queries measured ~2x slower, because the cost here is
  // per-round-trip latency rather than the counting itself.
  const [stats, latestBackup] = await Promise.all([
    prisma.$queryRaw<
      { active_users: bigint; total_users: bigint; activity_24h: bigint; settings_count: bigint }[]
    >`
      SELECT
        (SELECT COUNT(*) FROM users WHERE is_deleted = false AND status = 'ACTIVE') AS active_users,
        (SELECT COUNT(*) FROM users WHERE is_deleted = false) AS total_users,
        (SELECT COUNT(*) FROM activity_logs WHERE created_at >= ${dayAgo}) AS activity_24h,
        (SELECT COUNT(*) FROM system_settings) AS settings_count`,
    prisma.backupHistory.findFirst({
      orderBy: { createdAt: 'desc' },
      select: { backupName: true, status: true, createdAt: true, fileSize: true },
    }),
  ]);

  const databaseLatencyMs = Date.now() - startedAt;
  const row = stats[0];

  return {
    databaseStatus: row ? 'Connected' : 'Unreachable',
    databaseLatencyMs,
    activeUsers: Number(row?.active_users ?? 0),
    totalUsers: Number(row?.total_users ?? 0),
    activityLast24h: Number(row?.activity_24h ?? 0),
    settingsCount: Number(row?.settings_count ?? 0),
    serverTime: new Date().toISOString(),
    nodeVersion: process.version,
    environment: process.env.NODE_ENV ?? 'development',
    latestBackup: latestBackup
      ? {
          name: latestBackup.backupName,
          status: latestBackup.status,
          createdAt: latestBackup.createdAt.toISOString(),
          fileSize: latestBackup.fileSize === null ? null : Number(latestBackup.fileSize),
        }
      : null,
  };
}
