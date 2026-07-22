import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getNumberSequences } from '@/features/admin/admin.queries';
import { NumberingManager } from '@/features/admin/components/numbering-manager';

export const metadata: Metadata = { title: 'Numbering' };

export default async function NumberingPage() {
  const user = await requirePermission('settings.view');
  const sequences = await getNumberSequences();

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title="Numbering"
        description="Document code formats. Changes apply to new records only — existing codes never change."
      />
      <NumberingManager
        sequences={sequences}
        canManage={hasPermission(user, 'settings.manage')}
      />
    </div>
  );
}
