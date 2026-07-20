import type { Metadata } from 'next';
import { requirePermission } from '@/lib/auth/guards';
import { prisma } from '@/lib/prisma';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { EmptyState } from '@/components/shared/page-states';
import { getSetting } from '@/features/settings/settings.cache';
import { QuotationForm } from '@/features/quotation/components/quotation-form';

export const metadata: Metadata = { title: 'New Quotation' };

export default async function NewQuotationPage({
  searchParams,
}: {
  searchParams: Promise<{ customerId?: string }>;
}) {
  await requirePermission('quotation.create');
  const { customerId } = await searchParams;

  const [customers, companyState] = await Promise.all([
    prisma.customer.findMany({
      where: { isDeleted: false, status: { in: ['ACTIVE', 'INACTIVE'] } },
      orderBy: { customerName: 'asc' },
      take: 500,
      select: { id: true, customerCode: true, customerName: true },
    }),
    getSetting<string>('company.state', ''),
  ]);

  return (
    <div className="mx-auto max-w-5xl space-y-6">
      <PageHeader title="New quotation" description="Add line items to build a quotation." />
      {customers.length === 0 ? (
        <EmptyState
          title="No customers yet"
          description="Add a customer before creating a quotation."
          action={<ButtonLink href="/customers/new" size="sm">Add customer</ButtonLink>}
        />
      ) : (
        <QuotationForm
          customers={customers.map((c) => ({ id: c.id, code: c.customerCode, name: c.customerName }))}
          initialCustomerId={customerId}
          companyState={companyState}
        />
      )}
    </div>
  );
}
