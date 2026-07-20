/**
 * The authenticated user as the application sees it — identity, role, and the
 * flattened set of permission keys used for RBAC checks (spec §50, §53).
 */
import type { PermissionKey } from '@/constants/permissions';
import type { UserStatus } from '@prisma/client';

export interface AuthUser {
  id: string;
  email: string;
  fullName: string;
  employeeCode: string;
  roleId: string;
  roleName: string;
  /** Authority rank used by the approval engine (spec §284). */
  roleLevel: number;
  status: UserStatus;
  profilePhoto: string | null;
  /** Flattened permission keys granted via the user's role. */
  permissions: ReadonlySet<PermissionKey>;
}
