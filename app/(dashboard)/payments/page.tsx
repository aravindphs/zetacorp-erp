import type { Metadata } from 'next';
import { Plus } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { ButtonLink } from '@/components/shared/button-link';
import { paymentListQuerySchema } from '@/features/payment/payment.schema';
import { getPaymentList } from '@/features/payment/payment.queries';
import { PaymentTable } from '@/features/payment/components/payment-table';
import { PaymentFilters } from '@/features/payment/components/payment-filters';
import { PaymentExportButton } from '@/features/payment/components/export-button';

export const metadata: Metadata = { title: 'Payments' };

export default async function PaymentsPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const user = await requirePermission('payment.view');
  const query = paymentListQuerySchema.parse(await searchParams);
  const { rows, meta } = await getPaymentList(query);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Payments"
        description="Record customer payments against invoices and print receipts."
        actions={
          <div className="flex items-center gap-2">
            {hasPermission(user, 'payment.export') && <PaymentExportButton />}
            {hasPermission(user, 'payment.create') && (
              <ButtonLink href="/payments/new" size="sm">
                <Plus className="size-4" /> Record Payment
              </ButtonLink>
            )}
          </div>
        }
      />
      <PaymentFilters />
      <PaymentTable rows={rows} meta={meta} />
    </div>
  );
}
