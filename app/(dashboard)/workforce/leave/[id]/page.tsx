import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getLeaveDetail } from '@/features/leave/leave.queries';
import { canActOnApproval, getApprovalTimeline } from '@/services/approval.service';
import { LeaveDetailActions } from '@/features/leave/components/leave-detail-actions';
import { LEAVE_STATUS_CLASSES, LEAVE_STATUS_LABELS } from '@/features/leave/leave.types';
import { formatDate, formatDateTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Leave Request' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">{label}</td>
      <td className="px-3 py-2">{value ?? '—'}</td>
    </tr>
  );
}

export default async function LeaveDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('leave.view');
  const { id } = await params;
  const leave = await getLeaveDetail(id);
  if (!leave) notFound();

  // The engine decides whether this user approves *this* request (§284) —
  // holding leave.approve is necessary but not sufficient.
  const [timeline, canDecide] = await Promise.all([
    leave.approvalRequestId ? getApprovalTimeline(leave.approvalRequestId) : Promise.resolve([]),
    leave.approvalRequestId
      ? canActOnApproval(leave.approvalRequestId, user)
      : Promise.resolve(false),
  ]);

  const cards = [
    {
      label: 'Duration',
      value: `${leave.totalDays.toNumber()} day${leave.totalDays.toNumber() === 1 ? '' : 's'}`,
    },
    { label: 'Applied on', value: formatDate(leave.createdAt) },
    { label: 'Status', value: LEAVE_STATUS_LABELS[leave.status] },
    { label: 'Leave type', value: leave.leaveType.name },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{leave.leaveNumber}</h1>
            <Badge variant="secondary" className={LEAVE_STATUS_CLASSES[leave.status]}>
              {LEAVE_STATUS_LABELS[leave.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/workforce/employees/${leave.employee.id}`}
              className="text-primary hover:underline"
            >
              {leave.employee.fullName}
            </Link>{' '}
            · {leave.employee.employeeCode} · {formatDate(leave.fromDate)} –{' '}
            {formatDate(leave.toDate)}
          </p>
        </div>
        <LeaveDetailActions
          leaveId={leave.id}
          status={leave.status}
          isOwner={leave.employeeId === user.id}
          canApprove={hasPermission(user, 'leave.approve')}
          canReject={hasPermission(user, 'leave.reject')}
          canDecide={canDecide}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Request details</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <Row label="Leave type" value={leave.leaveType.name} />
                <Row label="From" value={formatDate(leave.fromDate)} />
                <Row label="To" value={formatDate(leave.toDate)} />
                <Row label="Half day" value={leave.isHalfDay ? 'Yes' : 'No'} />
                <Row label="Total days" value={leave.totalDays.toNumber()} />
                <Row label="Paid" value={leave.leaveType.isPaid ? 'Yes' : 'No'} />
                <Row label="Department" value={leave.employee.department?.name ?? '—'} />
                <Row label="Emergency contact" value={leave.emergencyContact ?? '—'} />
                <Row
                  label="Delegate"
                  value={
                    leave.delegate ? (
                      <Link
                        href={`/workforce/employees/${leave.delegate.id}`}
                        className="text-primary hover:underline"
                      >
                        {leave.delegate.fullName}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
                <Row label="Reason" value={leave.reason} />
                {leave.remarks && <Row label="Remarks" value={leave.remarks} />}
              </tbody>
            </table>
          </div>
        </div>

        {/* Approval timeline (§281, §284) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold">Approval timeline</h2>
          {timeline.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {leave.status === 'PENDING'
                ? 'Awaiting a decision from an approver.'
                : 'No approval activity recorded.'}
            </p>
          ) : (
            <ol className="space-y-3 rounded-lg border p-4">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      entry.action === 'APPROVED'
                        ? 'bg-green-500'
                        : entry.action === 'REJECTED'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{entry.stepName}</span> ·{' '}
                      {entry.action.toLowerCase()} by {entry.actorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                    {entry.remarks && <p className="mt-1 text-sm">{entry.remarks}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}
