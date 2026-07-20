import { NextResponse } from 'next/server';
import { withApiHandler } from '@/lib/api-response';
import { requirePermission } from '@/lib/auth/guards';
import { logActivity } from '@/services/activity-log.service';
import { toCsv } from '@/utils/csv';
import { leaveListQuerySchema } from '@/features/leave/leave.schema';
import { getLeaveList } from '@/features/leave/leave.queries';
import { LEAVE_STATUS_LABELS } from '@/features/leave/leave.types';

export const dynamic = 'force-dynamic';

/** GET /api/leaves/export — CSV of the current filtered set (§288). */
export const GET = withApiHandler(async (request, requestId) => {
  const user = await requirePermission('leave.export');
  const params = Object.fromEntries(new URL(request.url).searchParams);
  // Export the whole filtered set rather than one page.
  const query = leaveListQuerySchema.parse({ ...params, page: 1, pageSize: 100 });
  const { rows } = await getLeaveList(query, user);

  const headers = [
    'Request Number',
    'Employee',
    'Leave Type',
    'From',
    'To',
    'Days',
    'Half Day',
    'Status',
    'Applied',
    'Approved By',
  ];
  const csvRows = rows.map((r) => [
    r.leaveNumber,
    r.employeeName,
    r.leaveTypeName,
    r.fromDate.slice(0, 10),
    r.toDate.slice(0, 10),
    r.totalDays,
    r.isHalfDay ? 'Yes' : 'No',
    LEAVE_STATUS_LABELS[r.status],
    r.appliedDate.slice(0, 10),
    r.approverName ?? '',
  ]);

  await logActivity({
    userId: user.id,
    activity: `Exported ${rows.length} leave requests`,
    module: 'leave',
  });

  return new NextResponse(toCsv(headers, csvRows), {
    status: 200,
    headers: {
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="leave-${new Date().toISOString().slice(0, 10)}.csv"`,
      'x-request-id': requestId,
    },
  });
});
