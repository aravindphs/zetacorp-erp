'use client';

import { useRouter } from 'next/navigation';
import { FileDown, FileText, Printer } from 'lucide-react';
import { Button } from '@/components/ui/button';

/** Receipt/print/view-invoice quick actions for the payment detail page (spec §231). */
export function PaymentDetailActions({
  paymentId,
  invoiceId,
  canPrint,
}: {
  paymentId: string;
  invoiceId: string;
  canPrint: boolean;
}) {
  const router = useRouter();
  const receiptUrl = `/api/payments/${paymentId}/receipt`;

  return (
    <div className="flex flex-wrap items-center gap-2">
      {canPrint && (
        <>
          <Button size="sm" variant="outline" onClick={() => window.open(receiptUrl, '_blank')}>
            <FileDown className="size-4" /> Download PDF
          </Button>
          <Button
            size="sm"
            variant="outline"
            onClick={() => {
              const w = window.open(receiptUrl, '_blank');
              w?.addEventListener('load', () => w.print());
            }}
          >
            <Printer className="size-4" /> Print receipt
          </Button>
        </>
      )}
      <Button size="sm" variant="outline" onClick={() => router.push(`/invoices/${invoiceId}`)}>
        <FileText className="size-4" /> View invoice
      </Button>
    </div>
  );
}
