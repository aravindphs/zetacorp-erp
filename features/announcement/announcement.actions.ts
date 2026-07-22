'use server';

import { revalidatePath } from 'next/cache';
import { requirePermission } from '@/lib/auth/guards';
import { handleAction } from '@/lib/action-handler';
import { actionOk, type ActionResult } from '@/types/action';
import { uuidSchema } from '@/schemas/common';
import { announcementSchema } from '@/features/announcement/announcement.schema';
import {
  acknowledgeAnnouncement,
  createAnnouncement,
  deleteAnnouncement,
  setAnnouncementPublished,
  updateAnnouncement,
} from '@/features/announcement/announcement.service';

const LIST_PATH = '/announcements';

export async function createAnnouncementAction(
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('announcement.create');
    const announcement = await createAnnouncement(user, announcementSchema.parse(input));
    revalidatePath(LIST_PATH);
    return actionOk({ id: announcement.id }, 'Announcement created.');
  });
}

export async function updateAnnouncementAction(
  id: string,
  input: unknown,
): Promise<ActionResult<{ id: string }>> {
  return handleAction(async () => {
    const user = await requirePermission('announcement.update');
    const announcement = await updateAnnouncement(
      user,
      uuidSchema.parse(id),
      announcementSchema.parse(input),
    );
    revalidatePath(LIST_PATH);
    return actionOk({ id: announcement.id }, 'Announcement updated.');
  });
}

export async function setAnnouncementPublishedAction(
  id: string,
  published: boolean,
): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('announcement.publish');
    await setAnnouncementPublished(user, uuidSchema.parse(id), published);
    revalidatePath(LIST_PATH);
    return actionOk(null, published ? 'Announcement published.' : 'Announcement unpublished.');
  });
}

/**
 * Acknowledge an announcement. Only `announcement.view` is required — every
 * targeted user must be able to clear their own blocking prompt.
 */
export async function acknowledgeAnnouncementAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('announcement.view');
    await acknowledgeAnnouncement(user, uuidSchema.parse(id));
    return actionOk(null, 'Acknowledged.');
  });
}

export async function deleteAnnouncementAction(id: string): Promise<ActionResult<null>> {
  return handleAction(async () => {
    const user = await requirePermission('announcement.delete');
    await deleteAnnouncement(user, uuidSchema.parse(id));
    revalidatePath(LIST_PATH);
    return actionOk(null, 'Announcement deleted.');
  });
}
