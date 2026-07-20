import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { leaveListQuerySchema } from '@/features/leave/leave.schema';
import { getTeamLeave } from '@/features/leave/leave.queries';
import { LeaveTable } from '@/features/leave/components/leave-table';

export const metadata: Metadata = { title: 'Team Leave' };

export default async function TeamLeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('leave.team');
  const query = leaveListQuerySchema.parse(await searchParams);
  const { rows, meta } = await getTeamLeave(user, query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Team leave"
        description="Leave requested by your direct reports."
        actions={
          <ButtonLink href="/workforce/leave" variant="outline" size="sm">
            Back to leave
          </ButtonLink>
        }
      />
      <LeaveTable
        rows={rows}
        meta={meta}
        emptyTitle="No team members are currently on leave."
        emptyDescription="Employees who report to you will appear here when they request leave."
      />
    </div>
  );
}
