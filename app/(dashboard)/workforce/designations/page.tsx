import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { listDesignations } from '@/features/workforce/catalogue.service';
import { DesignationManager } from '@/features/workforce/components/designation-manager';

export const metadata: Metadata = { title: 'Designations' };

export default async function DesignationsPage() {
  const user = await requirePermission('employee.view');
  const designations = await listDesignations();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Designations"
        description="Job titles that can be assigned to employees."
        actions={
          <ButtonLink href="/workforce/employees" variant="outline" size="sm">
            Back to employees
          </ButtonLink>
        }
      />
      <DesignationManager
        designations={designations}
        canManage={hasPermission(user, 'designation.manage')}
      />
    </div>
  );
}
