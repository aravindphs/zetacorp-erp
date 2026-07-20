import type { Metadata } from 'next';
import Link from 'next/link';
import { CalendarDays, Plus, Users } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { Card, CardContent } from '@/components/ui/card';
import { leaveListQuerySchema } from '@/features/leave/leave.schema';
import {
  getLeaveDashboard,
  getLeaveList,
  getLeaveTypeOptions,
} from '@/features/leave/leave.queries';
import { LeaveTable } from '@/features/leave/components/leave-table';
import { LeaveFilters } from '@/features/leave/components/leave-filters';
import { formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Leave' };

export default async function LeavePage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('leave.view');
  const params = await searchParams;
  const query = leaveListQuerySchema.parse(params);

  // Independent reads issued together.
  const [dashboard, { rows, meta }, leaveTypes] = await Promise.all([
    getLeaveDashboard(),
    getLeaveList(query, user),
    getLeaveTypeOptions(),
  ]);

  const cards = [
    { label: 'Pending requests', value: dashboard.pending },
    { label: 'Approved this month', value: dashboard.approvedThisMonth },
    { label: 'Rejected this month', value: dashboard.rejectedThisMonth },
    { label: 'On leave today', value: dashboard.onLeaveToday },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title="Leave"
        description="Apply for leave, track approvals, and view team availability."
        actions={
          <div className="flex items-center gap-2">
            {hasPermission(user, 'leave.calendar') && (
              <ButtonLink href="/workforce/leave/calendar" variant="outline" size="sm">
                <CalendarDays className="size-4" /> Calendar
              </ButtonLink>
            )}
            {hasPermission(user, 'leave.team') && (
              <ButtonLink href="/workforce/leave/team" variant="outline" size="sm">
                <Users className="size-4" /> Team
              </ButtonLink>
            )}
            {hasPermission(user, 'leave.create') && (
              <ButtonLink href="/workforce/leave/apply" size="sm">
                <Plus className="size-4" /> Apply for Leave
              </ButtonLink>
            )}
          </div>
        }
      />

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-2xl font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      {dashboard.upcoming.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Upcoming leave</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                {dashboard.upcoming.map((u) => (
                  <tr key={u.id}>
                    <td className="px-3 py-2">
                      <Link
                        href={`/workforce/leave/${u.id}`}
                        className="font-medium text-primary hover:underline"
                      >
                        {u.leaveNumber}
                      </Link>
                    </td>
                    <td className="px-3 py-2">{u.employeeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">{u.leaveTypeName}</td>
                    <td className="px-3 py-2 text-muted-foreground">
                      {formatDate(u.fromDate)} – {formatDate(u.toDate)}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      <div className="flex flex-wrap items-center gap-2">
        <ButtonLink
          href="/workforce/leave?mine=true"
          variant={query.mine ? 'default' : 'outline'}
          size="sm"
        >
          My leave
        </ButtonLink>
        <ButtonLink href="/workforce/leave" variant={query.mine ? 'outline' : 'default'} size="sm">
          All requests
        </ButtonLink>
      </div>

      <LeaveFilters leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name }))} />
      <LeaveTable
        rows={rows}
        meta={meta}
        showEmployee={!query.mine}
        emptyTitle={query.mine ? "You haven't applied for any leave." : 'No leave requests found'}
        emptyDescription={
          query.mine ? 'Apply for leave to get started.' : 'Adjust your filters to see more.'
        }
      />
    </div>
  );
}
