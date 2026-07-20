import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getEmployeeOptions, getRoleOptions } from '@/features/workforce/employee.queries';
import { listDepartments, listDesignations } from '@/features/workforce/catalogue.service';
import { EmployeeForm } from '@/features/workforce/components/employee-form';

export const metadata: Metadata = { title: 'New Employee' };

export default async function NewEmployeePage() {
  await requirePermission('employee.create');
  const [departments, designations, roles, managers] = await Promise.all([
    listDepartments(false),
    listDesignations(false),
    getRoleOptions(),
    getEmployeeOptions(),
  ]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Add employee"
        description="Create the employee profile and their login account."
      />
      <EmployeeForm
        mode="create"
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        designations={designations.map((d) => ({ id: d.id, name: d.name }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
        managers={managers}
      />
    </div>
  );
}
