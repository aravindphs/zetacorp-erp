import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import {
  getEmployeeDetail,
  getEmployeeOptions,
  getRoleOptions,
} from '@/features/workforce/employee.queries';
import { listDepartments, listDesignations } from '@/features/workforce/catalogue.service';
import { EmployeeForm } from '@/features/workforce/components/employee-form';
import type { EmployeeFormInput } from '@/features/workforce/employee.schema';

export const metadata: Metadata = { title: 'Edit Employee' };

/** `<input type="date">` needs a yyyy-MM-dd value. */
function toDateInput(value: Date | null): string | undefined {
  return value ? value.toISOString().slice(0, 10) : undefined;
}

export default async function EditEmployeePage({ params }: { params: Promise<{ id: string }> }) {
  await requirePermission('employee.update');
  const { id } = await params;
  const [employee, departments, designations, roles, managers] = await Promise.all([
    getEmployeeDetail(id),
    listDepartments(false),
    listDesignations(false),
    getRoleOptions(),
    getEmployeeOptions(),
  ]);
  if (!employee) notFound();

  const defaultValues: Partial<EmployeeFormInput> = {
    firstName: employee.firstName ?? employee.fullName.split(' ')[0] ?? '',
    lastName: employee.lastName ?? employee.fullName.split(' ').slice(1).join(' ') ?? '',
    email: employee.email,
    phone: employee.phone ?? undefined,
    alternatePhone: employee.alternatePhone ?? undefined,
    gender: employee.gender ?? undefined,
    dateOfBirth: toDateInput(employee.dateOfBirth),
    bloodGroup: employee.bloodGroup ?? undefined,
    nationality: employee.nationality ?? undefined,
    maritalStatus: employee.maritalStatus ?? undefined,
    emergencyContactName: employee.emergencyContactName ?? undefined,
    emergencyContactPhone: employee.emergencyContactPhone ?? undefined,
    addressLine1: employee.addressLine1 ?? undefined,
    addressLine2: employee.addressLine2 ?? undefined,
    city: employee.city ?? undefined,
    state: employee.state ?? undefined,
    postalCode: employee.postalCode ?? undefined,
    departmentId: employee.departmentId ?? undefined,
    designationId: employee.designationId ?? undefined,
    roleId: employee.roleId,
    joiningDate: toDateInput(employee.joiningDate) ?? '',
    reportingManagerId: employee.reportingManagerId ?? undefined,
    employmentType: employee.employmentType ?? undefined,
    probationEndDate: toDateInput(employee.probationEndDate),
    workLocation: employee.workLocation ?? undefined,
    status: employee.status,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Edit ${employee.fullName}`}
        description={`${employee.employeeCode} · profile and account settings.`}
      />
      <EmployeeForm
        mode="edit"
        employeeId={employee.id}
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        designations={designations.map((d) => ({ id: d.id, name: d.name }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        managers={managers}
        defaultValues={defaultValues}
      />
    </div>
  );
}
