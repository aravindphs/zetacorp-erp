import type { Metadata } from 'next';
import { Plus, Upload } from 'lucide-react';
import { requirePermission, hasPermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { customerListQuerySchema } from '@/features/customer/customer.schema';
import { getCustomerList } from '@/features/customer/customer.service';
import { CustomerTable } from '@/features/customer/components/customer-table';
import { CustomerFilters } from '@/features/customer/components/customer-filters';
import { CustomerExportButton } from '@/features/customer/components/export-button';

export const metadata: Metadata = { title: 'Customers' };

export default async function CustomersPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('customer.view');
  const query = customerListQuerySchema.parse(await searchParams);
  const { rows, meta } = await getCustomerList(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Customers"
        description="Manage customer profiles, history, and outstanding balances."
        actions={
          <div className="flex items-center gap-2">
            {hasPermission(user, 'customer.import') && (
              <ButtonLink href="/customers/import" variant="outline" size="sm">
                <Upload className="size-4" /> Import
              </ButtonLink>
            )}
            {hasPermission(user, 'customer.export') && <CustomerExportButton />}
            {hasPermission(user, 'customer.create') && (
              <ButtonLink href="/customers/new" size="sm">
                <Plus className="size-4" /> Add Customer
              </ButtonLink>
            )}
          </div>
        }
      />

      <CustomerFilters />

      <CustomerTable
        rows={rows}
        meta={meta}
        canUpdate={hasPermission(user, 'customer.update')}
        canDelete={hasPermission(user, 'customer.delete')}
      />
    </div>
  );
}
