import type { Metadata } from 'next';
import { notFound, redirect } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getSetting } from '@/features/settings/settings.cache';
import { getLeaveDetail, getLeaveTypeOptions } from '@/features/leave/leave.queries';
import { getEmployeeOptions } from '@/features/workforce/employee.queries';
import { ApplyLeaveForm } from '@/features/leave/components/apply-leave-form';
import { EDITABLE_STATUSES } from '@/features/leave/leave.types';
import type { ApplyLeaveFormInput } from '@/features/leave/leave.schema';

export const metadata: Metadata = { title: 'Edit Leave Request' };

export default async function EditLeavePage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('leave.update');
  const { id } = await params;

  const [leave, leaveTypes, colleagues, excludeWeekends] = await Promise.all([
    getLeaveDetail(id),
    getLeaveTypeOptions(),
    getEmployeeOptions(),
    getSetting<boolean>('leave.exclude_weekends', true),
  ]);
  if (!leave) notFound();

  // Only the owner's own drafts are editable (§287) — bounce anything else back
  // to the detail page rather than rendering a form that cannot save.
  if (leave.employeeId !== user.id || !EDITABLE_STATUSES.includes(leave.status)) {
    redirect(`/workforce/leave/${id}`);
  }

  const defaultValues: Partial<ApplyLeaveFormInput> = {
    leaveTypeId: leave.leaveTypeId,
    fromDate: leave.fromDate.toISOString().slice(0, 10),
    toDate: leave.toDate.toISOString().slice(0, 10),
    isHalfDay: leave.isHalfDay,
    reason: leave.reason,
    emergencyContact: leave.emergencyContact ?? undefined,
    delegateEmployeeId: leave.delegateEmployeeId ?? undefined,
  };

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title={`Edit ${leave.leaveNumber}`}
        description="Update this draft, then save it or submit it for approval."
      />
      <ApplyLeaveForm
        mode="edit"
        leaveId={leave.id}
        leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name }))}
        colleagues={colleagues.filter((c) => c.id !== user.id)}
        excludeWeekends={Boolean(excludeWeekends)}
        defaultValues={defaultValues}
      />
    </div>
  );
}
