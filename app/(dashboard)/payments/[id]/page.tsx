import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getPaymentDetail } from '@/features/payment/payment.queries';
import { PaymentDetailActions } from '@/features/payment/components/payment-detail-actions';
import {
  PAYMENT_METHOD_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
} from '@/features/payment/payment.types';
import { formatCurrency, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Payment' };

export default async function PaymentDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('payment.view');
  const { id } = await params;
  const payment = await getPaymentDetail(id);
  if (!payment) notFound();

  const cards = [
    { label: 'Amount', value: formatCurrency(payment.amount.toNumber()), accent: true },
    { label: 'Method', value: PAYMENT_METHOD_LABELS[payment.paymentMethod] },
    { label: 'Reference', value: payment.referenceNumber ?? '—' },
    { label: 'Payment date', value: formatDate(payment.paymentDate) },
    { label: 'Invoice outstanding', value: formatCurrency(payment.invoice.balanceDue.toNumber()) },
    { label: 'Received by', value: payment.receivedBy },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{payment.paymentNumber}</h1>
            <Badge variant="secondary" className={PAYMENT_STATUS_CLASSES[payment.status]}>
              {PAYMENT_STATUS_LABELS[payment.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/customers/${payment.customer.id}`} className="text-primary hover:underline">
              {payment.customer.customerName}
            </Link>{' '}
            · against{' '}
            <Link href={`/invoices/${payment.invoice.id}`} className="text-primary hover:underline">
              {payment.invoice.invoiceNumber}
            </Link>{' '}
            · {formatDate(payment.paymentDate)}
          </p>
        </div>
        <PaymentDetailActions
          paymentId={payment.id}
          invoiceId={payment.invoice.id}
          canPrint={hasPermission(user, 'payment.print')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p
                className={`mt-1 truncate text-lg font-semibold tabular-nums ${c.accent ? 'text-green-600' : ''}`}
              >
                {c.value}
              </p>
            </CardContent>
          </Card>
        ))}
      </div>

      {/* Invoice settlement (spec §231 Invoice tab) */}
      <div>
        <h2 className="mb-2 text-sm font-semibold">Invoice settlement</h2>
        <div className="overflow-x-auto rounded-lg border">
          <table className="w-full text-sm">
            <tbody className="divide-y">
              <SettlementRow label="Invoice number">
                <Link href={`/invoices/${payment.invoice.id}`} className="text-primary hover:underline">
                  {payment.invoice.invoiceNumber}
                </Link>
              </SettlementRow>
              <SettlementRow label="Invoice date">{formatDate(payment.invoice.invoiceDate)}</SettlementRow>
              <SettlementRow label="Invoice total">
                {formatCurrency(payment.invoice.grandTotal.toNumber())}
              </SettlementRow>
              <SettlementRow label="Total paid to date">
                {formatCurrency(payment.invoice.amountPaid.toNumber())}
              </SettlementRow>
              <SettlementRow label="Outstanding">
                {formatCurrency(payment.invoice.balanceDue.toNumber())}
              </SettlementRow>
            </tbody>
          </table>
        </div>
      </div>

      {payment.remarks && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Remarks</h2>
          <p className="rounded-lg border p-4 text-sm text-muted-foreground">{payment.remarks}</p>
        </div>
      )}
    </div>
  );
}

function SettlementRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <tr>
      <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">{label}</td>
      <td className="px-3 py-2 tabular-nums">{children}</td>
    </tr>
  );
}
