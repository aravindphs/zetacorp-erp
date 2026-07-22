import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getPermissionCatalogue } from '@/features/admin/admin.queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/admin/permissions — the permission catalogue grouped by module
 * (§354, §365). Served from a process cache, so this is effectively instant.
 */
export const GET = withApiHandler(async (_request, requestId) => {
  await requirePermission('role.view');
  const groups = await getPermissionCatalogue();
  return apiSuccess(groups, { message: 'Permissions', requestId });
});
