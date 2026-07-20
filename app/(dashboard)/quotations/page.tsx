import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { quotationListQuerySchema } from '@/features/quotation/quotation.schema';
import { getQuotationList } from '@/features/quotation/quotation.queries';
import { QuotationTable } from '@/features/quotation/components/quotation-table';
import { QuotationFilters } from '@/features/quotation/components/quotation-filters';

export const metadata: Metadata = { title: 'Quotations' };

export default async function QuotationsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('quotation.view');
  const query = quotationListQuerySchema.parse(await searchParams);
  const { rows, meta } = await getQuotationList(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Quotations"
        description="Create and manage customer quotations."
        actions={
          hasPermission(user, 'quotation.create') && (
            <ButtonLink href="/quotations/new" size="sm">
              <Plus className="size-4" /> New Quotation
            </ButtonLink>
          )
        }
      />
      <QuotationFilters />
      <QuotationTable rows={rows} meta={meta} />
    </div>
  );
}
