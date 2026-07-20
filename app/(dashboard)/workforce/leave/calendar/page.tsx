import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { leaveCalendarQuerySchema } from '@/features/leave/leave.schema';
import { getLeaveCalendar } from '@/features/leave/leave.queries';
import { LeaveCalendar } from '@/features/leave/components/leave-calendar';

export const metadata: Metadata = { title: 'Leave Calendar' };

export default async function LeaveCalendarPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('leave.calendar');
  const query = leaveCalendarQuerySchema.parse(await searchParams);

  const now = new Date();
  const month = query.month ?? now.getMonth() + 1;
  const year = query.year ?? now.getFullYear();

  const entries = await getLeaveCalendar({ ...query, month, year });

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave calendar"
        description="Approved and pending leave across the organisation."
        actions={
          <ButtonLink href="/workforce/leave" variant="outline" size="sm">
            Back to leave
          </ButtonLink>
        }
      />
      <LeaveCalendar entries={entries} month={month} year={year} />
    </div>
  );
}
