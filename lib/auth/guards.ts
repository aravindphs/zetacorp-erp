/**
 * RBAC guards (spec §15, §53, §54, §57).
 *
 * Checks are ALWAYS permission-based (does the user hold `module.action`?) and
 * never role-name based, so custom roles work in the future (spec §53). Use the
 * `require*` helpers in Server Actions and Route Handlers — they throw typed
 * `AppError`s that the API layer maps to 401/403.
 */
import 'server-only';
import { getCurrentUser } from '@/lib/auth/session';
import { ForbiddenError, UnauthenticatedError } from '@/lib/errors';
import type { AuthUser } from '@/types/auth';
import type { PermissionKey } from '@/constants/permissions';

/** Non-throwing permission check. */
export function hasPermission(user: AuthUser, permission: PermissionKey): boolean {
  return user.permissions.has(permission);
}

/** Non-throwing check: does the user hold ANY of these permissions? */
export function hasAnyPermission(user: AuthUser, permissions: readonly PermissionKey[]): boolean {
  return permissions.some((p) => user.permissions.has(p));
}

/** Resolve the current user or throw 401. */
export async function requireUser(): Promise<AuthUser> {
  const user = await getCurrentUser();
  if (!user) throw new UnauthenticatedError();
  return user;
}

/** Resolve the current user and assert a permission, or throw 401/403. */
export async function requirePermission(permission: PermissionKey): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasPermission(user, permission)) throw new ForbiddenError();
  return user;
}

/** Resolve the current user and assert they hold at least one permission. */
export async function requireAnyPermission(
  permissions: readonly PermissionKey[],
): Promise<AuthUser> {
  const user = await requireUser();
  if (!hasAnyPermission(user, permissions)) throw new ForbiddenError();
  return user;
}

/**
 * Ownership guard (spec §57–§58). Some records (leave, expenses) are visible to
 * their owner plus anyone holding an elevated "view-all" permission (typically
 * Manager/Admin via e.g. `expense.approve`). Throws 403 when neither holds.
 */
export function assertOwnershipOrPermission(
  user: AuthUser,
  ownerId: string,
  elevatedPermission: PermissionKey,
): void {
  if (user.id === ownerId) return;
  if (hasPermission(user, elevatedPermission)) return;
  throw new ForbiddenError();
}

/**
 * Whether the user may see all records in an owner-scoped module, or only their
 * own. Repositories use this to decide whether to filter by `ownerId`.
 */
export function canViewAll(user: AuthUser, elevatedPermission: PermissionKey): boolean {
  return hasPermission(user, elevatedPermission);
}
