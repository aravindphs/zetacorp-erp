import type { Metadata } from 'next';
import { z } from 'zod';
import { requirePermission } from '@/lib/auth/guards';
import { PageHeader } from '@/components/shared/page-header';
import { getOutstandingInvoiceById } from '@/features/payment/payment.queries';
import { RecordPaymentForm } from '@/features/payment/components/record-payment-form';

export const metadata: Metadata = { title: 'Record Payment' };

export default async function NewPaymentPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  await requirePermission('payment.create');
  const { invoiceId } = await searchParams;
  const parsed = z.string().uuid().safeParse(invoiceId);
  const initialInvoice = parsed.success ? await getOutstandingInvoiceById(parsed.data) : null;

  return (
    <div className="mx-auto max-w-3xl space-y-6">
      <PageHeader
        title="Record Payment"
        description="Select a posted invoice with an outstanding balance and record a payment."
      />
      <RecordPaymentForm initialInvoice={initialInvoice} />
    </div>
  );
}
