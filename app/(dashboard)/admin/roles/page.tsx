import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import {
  getPermissionCatalogue,
  getRolePermissionIds,
  getRoles,
} from '@/features/admin/admin.queries';
import { RoleManager } from '@/features/admin/components/role-manager';

export const metadata: Metadata = { title: 'Roles & Permissions' };

export default async function AdminRolesPage() {
  const user = await requirePermission('role.view');

  const [roles, catalogue] = await Promise.all([getRoles(), getPermissionCatalogue()]);

  // Grants for every role, fetched in parallel — a handful of tiny id-only
  // queries rather than one large join.
  const grantLists = await Promise.all(roles.map((r) => getRolePermissionIds(r.id)));
  const grantedByRole = Object.fromEntries(roles.map((r, i) => [r.id, grantLists[i] ?? []]));

  return (
    <div className="space-y-6">
      <PageHeader
        title="Roles & permissions"
        description="Role-based access control. Permission changes take effect immediately."
      />
      <RoleManager
        roles={roles}
        catalogue={catalogue}
        grantedByRole={grantedByRole}
        canManage={hasPermission(user, 'role.manage')}
      />
    </div>
  );
}
