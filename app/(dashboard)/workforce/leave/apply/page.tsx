import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getSetting } from '@/features/settings/settings.cache';
import { getLeaveTypeOptions } from '@/features/leave/leave.queries';
import { getEmployeeOptions } from '@/features/workforce/employee.queries';
import { ApplyLeaveForm } from '@/features/leave/components/apply-leave-form';

export const metadata: Metadata = { title: 'Apply for Leave' };

export default async function ApplyLeavePage() {
  const user = await requirePermission('leave.create');
  const [leaveTypes, colleagues, excludeWeekends] = await Promise.all([
    getLeaveTypeOptions(),
    getEmployeeOptions(),
    getSetting<boolean>('leave.exclude_weekends', true),
  ]);

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Apply for leave"
        description="Submit a request for approval, or save it as a draft."
      />
      <ApplyLeaveForm
        mode="create"
        leaveTypes={leaveTypes.map((t) => ({ id: t.id, name: t.name }))}
        colleagues={colleagues.filter((c) => c.id !== user.id)}
        excludeWeekends={Boolean(excludeWeekends)}
      />
    </div>
  );
}
