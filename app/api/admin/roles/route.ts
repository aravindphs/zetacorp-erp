import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import { roleSchema } from '@/features/admin/admin.schema';
import { getRoles } from '@/features/admin/admin.queries';
import { createRole } from '@/features/admin/admin.service';

export const dynamic = 'force-dynamic';

/** GET /api/admin/roles — roles with permission and employee counts (§365). */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('role.view');
  const roles = await getRoles();
  return apiSuccess(roles, { message: 'Roles', requestId });
});

/** POST /api/admin/roles — create a custom role (§365). */
export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('role.manage');
  const role = await createRole(user, roleSchema.parse(await request.json()));
  return apiSuccess(
    { id: role.id, name: role.name },
    { message: 'Role created', status: HttpStatus.CREATED, requestId },
  );
});
