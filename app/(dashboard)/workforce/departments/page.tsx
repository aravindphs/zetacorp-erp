import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { listDepartments } from '@/features/workforce/catalogue.service';
import { getEmployeeOptions } from '@/features/workforce/employee.queries';
import { DepartmentManager } from '@/features/workforce/components/department-manager';

export const metadata: Metadata = { title: 'Departments' };

export default async function DepartmentsPage() {
  const user = await requirePermission('employee.view');
  const [departments, managers] = await Promise.all([listDepartments(), getEmployeeOptions()]);

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Departments"
        description="Organise employees into departments and assign department heads."
        actions={
          <ButtonLink href="/workforce/employees" variant="outline" size="sm">
            Back to employees
          </ButtonLink>
        }
      />
      <DepartmentManager
        departments={departments}
        managers={managers}
        canManage={hasPermission(user, 'department.manage')}
      />
    </div>
  );
}
