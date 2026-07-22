import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { getPendingAcknowledgements } from '@/features/announcement/announcement.queries';

export const dynamic = 'force-dynamic';

/**
 * GET /api/announcements/pending — published announcements targeting this user
 * that they have not acknowledged yet. Drives the blocking prompt, so it is a
 * single indexed query.
 */
export const GET = withApiHandler(async (_request, requestId) => {
  const user = await requirePermission('announcement.view');
  const pending = await getPendingAcknowledgements(user);
  return apiSuccess(pending, { message: 'Pending announcements', requestId });
});
