import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getCustomerById } from '@/features/customer/customer.repository';
import { CustomerForm } from '@/features/customer/components/customer-form';
import type { CustomerFormInput } from '@/features/customer/customer.schema';

export const metadata: Metadata = { title: 'Edit Customer' };

export default async function EditCustomerPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission('customer.update');
  const { id } = await params;
  const customer = await getCustomerById(id);
  if (!customer) notFound();

  const defaultValues: Partial<CustomerFormInput> = {
    customerType: customer.customerType,
    companyName: customer.companyName ?? undefined,
    customerName: customer.customerName,
    phone: customer.phone,
    alternatePhone: customer.alternatePhone ?? undefined,
    email: customer.email ?? undefined,
    website: customer.website ?? undefined,
    gstNumber: customer.gstNumber ?? undefined,
    panNumber: customer.panNumber ?? undefined,
    aadhaarNumber: customer.aadhaarNumber ?? undefined,
    notes: customer.notes ?? undefined,
    industry: customer.industry ?? undefined,
    businessSize: customer.businessSize ?? undefined,
    paymentTermsDays: customer.paymentTermsDays ?? undefined,
    creditLimit: customer.creditLimit.toNumber(),
    preferredContactMethod: customer.preferredContactMethod ?? undefined,
    status: customer.status,
  };

  return (
    <div className="mx-auto max-w-4xl space-y-6">
      <PageHeader
        title={`Edit ${customer.customerName}`}
        description={`Customer ${customer.customerCode}`}
      />
      <CustomerForm
        mode="edit"
        customerId={customer.id}
        canOverride={hasPermission(user, 'customer.delete')}
        defaultValues={defaultValues}
      />
    </div>
  );
}
