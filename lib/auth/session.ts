/**
 * Server-side session & profile loading (spec §47, §50).
 *
 * `getCurrentUser` validates the Supabase session and loads the user's profile,
 * role, and permissions in a single optimised query (spec §50 — "avoid multiple
 * API requests"). The result is memoised per request via React `cache` so many
 * callers in one render share one round-trip.
 */
import 'server-only';
import { cache } from 'react';
import { headers } from 'next/headers';
import { createSupabaseServerClient } from '@/lib/supabase/server';
import { USER_ID_HEADER } from '@/lib/supabase/middleware';
import { prisma } from '@/lib/prisma';
import type { AuthUser } from '@/types/auth';
import type { PermissionKey } from '@/constants/permissions';

/**
 * Resolve the authenticated user id. Fast path: the middleware has already
 * validated the session and forwarded the id via `x-user-id` (see
 * lib/supabase/middleware). Fallback (e.g. contexts the middleware didn't
 * touch): validate over the network via Supabase Auth.
 */
async function resolveUserId(): Promise<string | null> {
  const forwarded = (await headers()).get(USER_ID_HEADER);
  if (forwarded) return forwarded;

  const supabase = await createSupabaseServerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user?.id ?? null;
}

/**
 * Returns the current authenticated, active user or `null`.
 *
 * A user is only considered authenticated when: a valid Supabase session
 * exists, a matching non-deleted `users` row exists, and their status is
 * ACTIVE (spec §14, §48 — inactive/deleted users cannot access the system).
 */
/**
 * Short-TTL cross-request cache of the resolved profile/permissions, keyed by
 * the *already-validated* user id. Avoids the role+permissions DB round-trip on
 * every navigation. Staleness is bounded to `PROFILE_TTL_MS`; after logout the
 * middleware forwards no id, so `resolveUserId` returns null before this cache
 * is ever consulted (fail-safe). Permission changes reflect within the TTL.
 */
const PROFILE_TTL_MS = 20_000;
const profileCache = new Map<string, { user: AuthUser; expiresAt: number }>();

/**
 * Permission sets are a property of the *role*, not the user, and there are only
 * a handful of roles. Joining role → role_permissions → permissions on every
 * request pulled ~80 rows and measured ~250ms slower than fetching the user
 * alone, so the set is cached per role and shared by every user holding it.
 * Role permission edits must call `invalidateRolePermissions`.
 */
const ROLE_PERMISSIONS_TTL_MS = 60_000;
const rolePermissionsCache = new Map<
  string,
  { permissions: ReadonlySet<PermissionKey>; expiresAt: number }
>();

async function loadRolePermissions(roleId: string): Promise<ReadonlySet<PermissionKey>> {
  const cached = rolePermissionsCache.get(roleId);
  if (cached && cached.expiresAt > Date.now()) return cached.permissions;

  const rows = await prisma.rolePermission.findMany({
    where: { roleId },
    select: { permission: { select: { key: true } } },
  });
  const permissions = new Set<PermissionKey>(rows.map((r) => r.permission.key as PermissionKey));

  rolePermissionsCache.set(roleId, {
    permissions,
    expiresAt: Date.now() + ROLE_PERMISSIONS_TTL_MS,
  });
  return permissions;
}

async function loadUserProfile(userId: string): Promise<AuthUser | null> {
  const cached = profileCache.get(userId);
  if (cached && cached.expiresAt > Date.now()) return cached.user;

  const dbUser = await prisma.user.findFirst({
    where: { id: userId, isDeleted: false },
    select: {
      id: true,
      email: true,
      fullName: true,
      employeeCode: true,
      roleId: true,
      status: true,
      profilePhoto: true,
      role: { select: { name: true } },
    },
  });

  if (!dbUser || dbUser.status !== 'ACTIVE') {
    profileCache.delete(userId);
    return null;
  }

  const permissions = await loadRolePermissions(dbUser.roleId);

  const user: AuthUser = {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    employeeCode: dbUser.employeeCode,
    roleId: dbUser.roleId,
    roleName: dbUser.role.name,
    status: dbUser.status,
    profilePhoto: dbUser.profilePhoto,
    permissions: permissions as Set<PermissionKey>,
  };

  profileCache.set(userId, { user, expiresAt: Date.now() + PROFILE_TTL_MS });
  return user;
}

/** Drop a user's cached profile (call after role/permission/profile changes). */
export function invalidateUserProfile(userId: string): void {
  profileCache.delete(userId);
}

/**
 * Drop cached role permissions. Call after editing a role's permission grants;
 * omit `roleId` to clear every role.
 */
export function invalidateRolePermissions(roleId?: string): void {
  if (roleId) rolePermissionsCache.delete(roleId);
  else rolePermissionsCache.clear();
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const userId = await resolveUserId();
  if (!userId) return null;
  return loadUserProfile(userId);
});
