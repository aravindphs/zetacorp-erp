import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { uuidSchema } from '@/schemas/common';
import { roleSchema, rolePermissionsSchema } from '@/features/admin/admin.schema';
import { getRolePermissionIds } from '@/features/admin/admin.queries';
import { deleteRole, setRolePermissions, updateRole } from '@/features/admin/admin.service';

export const dynamic = 'force-dynamic';

type Ctx = { params: Promise<{ id: string }> };

/** GET /api/admin/roles/{id} — the role's granted permission ids. */
export const GET = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  await requirePermission('role.view');
  const { id } = await ctx.params;
  const permissionIds = await getRolePermissionIds(uuidSchema.parse(id));
  return apiSuccess({ permissionIds }, { message: 'Role permissions', requestId });
});

/**
 * PUT /api/admin/roles/{id} — update the role, and replace its permission
 * grants when `permissionIds` is supplied (§365).
 */
export const PUT = withApiHandler(async (request, requestId, ctx: Ctx) => {
  const user = await requirePermission('role.manage');
  const { id } = await ctx.params;
  const roleId = uuidSchema.parse(id);
  const body = await request.json();

  if (Array.isArray(body?.permissionIds)) {
    const { permissionIds } = rolePermissionsSchema.parse(body);
    await setRolePermissions(user, roleId, permissionIds);
    return apiSuccess(null, { message: 'Permissions updated', requestId });
  }

  const role = await updateRole(user, roleId, roleSchema.parse(body));
  return apiSuccess({ id: role.id }, { message: 'Role updated', requestId });
});

export const DELETE = withApiHandler(async (_request, requestId, ctx: Ctx) => {
  const user = await requirePermission('role.manage');
  const { id } = await ctx.params;
  await deleteRole(user, uuidSchema.parse(id));
  return apiSuccess(null, { message: 'Role deleted', requestId });
});
