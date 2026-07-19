import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { CustomerForm } from '@/features/customer/components/customer-form';

export const metadata: Metadata = { title: 'Add Customer' };

export default async function NewCustomerPage() {
  const user = await requirePermission('customer.create');

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader title="Add customer" description="Create a new customer profile." />
      <CustomerForm mode="create" canOverride={hasPermission(user, 'customer.delete')} />
    </div>
  );
}
