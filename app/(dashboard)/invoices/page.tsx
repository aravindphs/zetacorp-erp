import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { invoiceListQuerySchema } from '@/features/invoice/invoice.schema';
import { getInvoiceList } from '@/features/invoice/invoice.queries';
import { InvoiceTable } from '@/features/invoice/components/invoice-table';
import { InvoiceFilters } from '@/features/invoice/components/invoice-filters';

export const metadata: Metadata = { title: 'Invoices' };

export default async function InvoicesPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('invoice.view');
  const query = invoiceListQuerySchema.parse(await searchParams);
  const { rows, meta } = await getInvoiceList(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Invoices"
        description="Create GST invoices, track payments, and manage stock."
        actions={
          hasPermission(user, 'invoice.create') && (
            <ButtonLink href="/invoices/new" size="sm">
              <Plus className="size-4" /> New Invoice
            </ButtonLink>
          )
        }
      />
      <InvoiceFilters />
      <InvoiceTable rows={rows} meta={meta} />
    </div>
  );
}
