import { apiSuccess, withApiHandler } from '@/lib/api-response';
import { HttpStatus } from '@/lib/http-status';
import { requirePermission } from '@/lib/auth/guards';
import {
  announcementListQuerySchema,
  announcementSchema,
} from '@/features/announcement/announcement.schema';
import {
  getActiveAnnouncements,
  getAnnouncementList,
} from '@/features/announcement/announcement.queries';
import { createAnnouncement } from '@/features/announcement/announcement.service';

export const dynamic = 'force-dynamic';

/**
 * GET /api/announcements — the full list, or `?active=true` for the feed of
 * announcements currently visible to the caller.
 */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('announcement.view');
  const url = new URL(request.url);

  if (url.searchParams.get('active') === 'true') {
    const active = await getActiveAnnouncements(user);
    return apiSuccess(active, { message: 'Active announcements', requestId });
  }

  const query = announcementListQuerySchema.parse(Object.fromEntries(url.searchParams));
  const { rows, meta } = await getAnnouncementList(query);
  return apiSuccess(rows, { message: 'Announcements', meta, requestId });
});

export const POST = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('announcement.create');
  const announcement = await createAnnouncement(user, announcementSchema.parse(await request.json()));
  return apiSuccess(
    { id: announcement.id, title: announcement.title },
    { message: 'Announcement created', status: HttpStatus.CREATED, requestId },
  );
});
