import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import {
  getEmployeeActivity,
  getEmployeeDetail,
  getRoleOptions,
} from '@/features/workforce/employee.queries';
import { EmployeeDetailActions } from '@/features/workforce/components/employee-detail-actions';
import { EmployeeDocuments } from '@/features/workforce/components/employee-documents';
import {
  EMPLOYEE_STATUS_CLASSES,
  EMPLOYEE_STATUS_LABELS,
  EMPLOYMENT_TYPE_LABELS,
  GENDER_LABELS,
  MARITAL_STATUS_LABELS,
} from '@/features/workforce/employee.types';
import { formatDate, formatDateTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Employee' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">{label}</td>
      <td className="px-3 py-2">{value ?? '—'}</td>
    </tr>
  );
}

export default async function EmployeeDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('employee.view');
  const { id } = await params;
  const [employee, roles] = await Promise.all([getEmployeeDetail(id), getRoleOptions()]);
  if (!employee) notFound();

  const activity = await getEmployeeActivity(employee.id);

  const cards = [
    { label: 'Joining date', value: formatDate(employee.joiningDate) },
    { label: 'Department', value: employee.department?.name ?? '—' },
    { label: 'Designation', value: employee.designation?.name ?? '—' },
    { label: 'Role', value: employee.role.name },
    { label: 'Last login', value: employee.lastLoginAt ? formatDateTime(employee.lastLoginAt) : 'Never' },
    { label: 'Activity', value: String(activity.length) },
  ];

  const address = [
    employee.addressLine1,
    employee.addressLine2,
    employee.city,
    employee.state,
    employee.postalCode,
  ]
    .filter(Boolean)
    .join(', ');

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{employee.fullName}</h1>
            <Badge variant="secondary" className={EMPLOYEE_STATUS_CLASSES[employee.status]}>
              {EMPLOYEE_STATUS_LABELS[employee.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {employee.employeeCode} · {employee.email}
            {employee.phone ? ` · ${employee.phone}` : ''}
          </p>
        </div>
        <EmployeeDetailActions
          employeeId={employee.id}
          currentRoleId={employee.roleId}
          currentStatus={employee.status}
          roles={roles.map((r) => ({ id: r.id, name: r.name }))}
          canUpdate={hasPermission(user, 'employee.update')}
          canResetPassword={hasPermission(user, 'employee.reset_password')}
          canChangeRole={hasPermission(user, 'employee.change_role')}
          isSelf={employee.id === user.id}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
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
        {/* Personal information (§250) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold">Personal information</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <Row label="Full name" value={employee.fullName} />
                <Row label="Gender" value={employee.gender ? GENDER_LABELS[employee.gender] : '—'} />
                <Row label="Date of birth" value={formatDate(employee.dateOfBirth)} />
                <Row label="Blood group" value={employee.bloodGroup ?? '—'} />
                <Row label="Nationality" value={employee.nationality ?? '—'} />
                <Row
                  label="Marital status"
                  value={employee.maritalStatus ? MARITAL_STATUS_LABELS[employee.maritalStatus] : '—'}
                />
                <Row label="Alternate phone" value={employee.alternatePhone ?? '—'} />
                <Row
                  label="Emergency contact"
                  value={
                    employee.emergencyContactName
                      ? `${employee.emergencyContactName}${employee.emergencyContactPhone ? ` · ${employee.emergencyContactPhone}` : ''}`
                      : '—'
                  }
                />
                <Row label="Address" value={address || '—'} />
              </tbody>
            </table>
          </div>
        </div>

        {/* Employment information (§251) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold">Employment</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <Row label="Employee code" value={employee.employeeCode} />
                <Row label="Department" value={employee.department?.name ?? '—'} />
                <Row label="Designation" value={employee.designation?.name ?? '—'} />
                <Row label="Joining date" value={formatDate(employee.joiningDate)} />
                <Row
                  label="Employment type"
                  value={employee.employmentType ? EMPLOYMENT_TYPE_LABELS[employee.employmentType] : '—'}
                />
                <Row label="Probation ends" value={formatDate(employee.probationEndDate)} />
                <Row label="Work location" value={employee.workLocation ?? '—'} />
                <Row
                  label="Reporting manager"
                  value={
                    employee.reportingManager ? (
                      <Link
                        href={`/workforce/employees/${employee.reportingManager.id}`}
                        className="text-primary hover:underline"
                      >
                        {employee.reportingManager.fullName}
                      </Link>
                    ) : (
                      '—'
                    )
                  }
                />
                <Row
                  label="Last password change"
                  value={
                    employee.lastPasswordChangeAt
                      ? formatDateTime(employee.lastPasswordChangeAt)
                      : '—'
                  }
                />
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Documents (§255) — private bucket, signed URLs only */}
      {hasPermission(user, 'employee.documents') && (
        <EmployeeDocuments
          employeeId={employee.id}
          documents={employee.documents.map((d) => ({
            id: d.id,
            documentType: d.documentType,
            fileName: d.fileName,
            mimeType: d.mimeType,
            fileSize: d.fileSize,
            remarks: d.remarks,
            createdAt: d.createdAt.toISOString(),
          }))}
          canManage={hasPermission(user, 'employee.documents')}
        />
      )}

      {/* Activity (§256) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Recent activity</h2>
        {activity.length === 0 ? (
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">
            No activity recorded yet.
          </p>
        ) : (
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">When</th>
                  <th className="px-3 py-2 font-medium">Module</th>
                  <th className="px-3 py-2 font-medium">Activity</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {activity.map((a) => (
                  <tr key={a.id}>
                    <td className="whitespace-nowrap px-3 py-2 text-muted-foreground">
                      {formatDateTime(a.createdAt)}
                    </td>
                    <td className="px-3 py-2">
                      <Badge variant="secondary">{a.module}</Badge>
                    </td>
                    <td className="px-3 py-2">{a.activity}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
