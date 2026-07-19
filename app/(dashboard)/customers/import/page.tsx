import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { ImportCustomers } from '@/features/customer/components/import-customers';

export const metadata: Metadata = { title: 'Import Customers' };

export default async function ImportCustomersPage() {
  await requirePermission('customer.import');

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Import customers"
        description="Bulk-create customers from a CSV file."
        actions={
          <ButtonLink href="/customers" variant="outline" size="sm">
            Back to customers
          </ButtonLink>
        }
      />
      <ImportCustomers />
    </div>
  );
}
