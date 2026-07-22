import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { announcementListQuerySchema } from '@/features/announcement/announcement.schema';
import { getAnnouncementList } from '@/features/announcement/announcement.queries';
import { AnnouncementManager } from '@/features/announcement/components/announcement-manager';

export const metadata: Metadata = { title: 'Announcements' };

export default async function AnnouncementsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('announcement.view');
  const query = announcementListQuerySchema.parse(await searchParams);

  const [{ rows }, roles] = await Promise.all([
    getAnnouncementList(query),
    prisma.role.findMany({
      where: { isDeleted: false },
      orderBy: { level: 'desc' },
      select: { name: true },
    }),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Announcements"
        description="Company-wide updates for your team."
      />
      <AnnouncementManager
        announcements={rows}
        roles={roles.map((r) => r.name)}
        perms={{
          canCreate: hasPermission(user, 'announcement.create'),
          canUpdate: hasPermission(user, 'announcement.update'),
          canDelete: hasPermission(user, 'announcement.delete'),
          canPublish: hasPermission(user, 'announcement.publish'),
        }}
      />
    </div>
  );
}
