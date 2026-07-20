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
      department: { select: { name: true } },
      designation: { select: { name: true } },
      status: true,
      profilePhoto: true,
      role: {
        select: {
          name: true,
          rolePermissions: { select: { permission: { select: { key: true } } } },
        },
      },
    },
  });

  if (!dbUser || dbUser.status !== 'ACTIVE') {
    profileCache.delete(userId);
    return null;
  }

  const user: AuthUser = {
    id: dbUser.id,
    email: dbUser.email,
    fullName: dbUser.fullName,
    employeeCode: dbUser.employeeCode,
    roleId: dbUser.roleId,
    roleName: dbUser.role.name,
    department: dbUser.department?.name ?? null,
    designation: dbUser.designation?.name ?? null,
    status: dbUser.status,
    profilePhoto: dbUser.profilePhoto,
    permissions: new Set<PermissionKey>(
      dbUser.role.rolePermissions.map((rp) => rp.permission.key as PermissionKey),
    ),
  };

  profileCache.set(userId, { user, expiresAt: Date.now() + PROFILE_TTL_MS });
  return user;
}

/** Drop a user's cached profile (call after role/permission/profile changes). */
export function invalidateUserProfile(userId: string): void {
  profileCache.delete(userId);
}

export const getCurrentUser = cache(async (): Promise<AuthUser | null> => {
  const userId = await resolveUserId();
  if (!userId) return null;
  return loadUserProfile(userId);
});
