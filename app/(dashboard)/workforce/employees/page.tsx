import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { employeeListQuerySchema } from '@/features/workforce/employee.schema';
import { getEmployeeList, getRoleOptions } from '@/features/workforce/employee.queries';
import { listDepartments } from '@/features/workforce/catalogue.service';
import { EmployeeTable } from '@/features/workforce/components/employee-table';
import { EmployeeFilters } from '@/features/workforce/components/employee-filters';

export const metadata: Metadata = { title: 'Employees' };

export default async function EmployeesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('employee.view');
  const query = employeeListQuerySchema.parse(await searchParams);
  const [{ rows, meta }, departments, roles] = await Promise.all([
    getEmployeeList(query),
    listDepartments(),
    getRoleOptions(),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Employees"
        description="Manage employee profiles, user accounts, and access."
        actions={
          hasPermission(user, 'employee.create') && (
            <ButtonLink href="/workforce/employees/new" size="sm">
              <Plus className="size-4" /> Add Employee
            </ButtonLink>
          )
        }
      />
      <EmployeeFilters
        departments={departments.map((d) => ({ id: d.id, name: d.name }))}
        roles={roles.map((r) => ({ id: r.id, name: r.name }))}
      />
      <EmployeeTable rows={rows} meta={meta} />
    </div>
  );
}
