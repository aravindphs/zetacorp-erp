import type { Metadata } from 'next';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { EmptyState } from '@/components/shared/page-states';
import { getSetting } from '@/features/settings/settings.cache';
import { InvoiceForm } from '@/features/invoice/components/invoice-form';

export const metadata: Metadata = { title: 'New Invoice' };

export default async function NewInvoicePage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  const user = await requirePermission('invoice.create');
  const { customerId } = await searchParams;

  const [customers, companyState] = await Promise.all([
    prisma.customer.findMany({
      where: { isDeleted: false, status: { in: ['ACTIVE', 'INACTIVE'] } },
      orderBy: { customerName: 'asc' },
      take: 500,
      select: {
        id: true,
        customerCode: true,
        customerName: true,
        // Default address travels with the option so the bill-to field can be
        // pre-filled the moment a customer is chosen.
        addresses: {
          where: { isDeleted: false },
          orderBy: { isDefault: 'desc' },
          take: 1,
          select: {
            addressLine1: true,
            addressLine2: true,
            city: true,
            state: true,
            postalCode: true,
          },
        },
      },
    }),
    getSetting<string>('company.state', ''),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="New invoice" description="Add line items and post to deduct stock." />
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer before creating an invoice."
          action={<ButtonLink href="/customers/new" size="sm">Add customer</ButtonLink>}
        />
      ) : (
        <InvoiceForm
          customers={customers.map((c) => {
            const a = c.addresses[0];
            return {
              id: c.id,
              code: c.customerCode,
              name: c.customerName,
              address: a
                ? [a.addressLine1, a.addressLine2, a.city, a.state, a.postalCode]
                    .map((p) => p?.trim())
                    .filter(Boolean)
                    .join(', ')
                : '',
            };
          })}
          initialCustomerId={customerId}
          canPost={hasPermission(user, 'invoice.post')}
          companyState={companyState}
        />
      )}
    </div>
  );
}
