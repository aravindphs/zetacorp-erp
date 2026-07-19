import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getInvoiceDetail } from '@/features/invoice/invoice.queries';
import { InvoiceDetailActions } from '@/features/invoice/components/invoice-detail-actions';
import {
  INVOICE_STATUS_CLASSES,
  INVOICE_STATUS_LABELS,
  PAYMENT_STATUS_CLASSES,
  PAYMENT_STATUS_LABELS,
} from '@/features/invoice/invoice.types';
import { formatCurrency, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Invoice' };

export default async function InvoiceDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('invoice.view');
  const { id } = await params;
  const invoice = await getInvoiceDetail(id);
  if (!invoice) notFound();

  const grandTotal = invoice.grandTotal.toNumber();
  const amountPaid = invoice.amountPaid.toNumber();
  const balanceDue = invoice.balanceDue.toNumber();

  const cards = [
    { label: 'Items', value: String(invoice.items.length) },
    { label: 'Taxable', value: formatCurrency(invoice.taxableAmount.toNumber()) },
    { label: 'GST', value: formatCurrency(invoice.gstAmount.toNumber()) },
    { label: 'Grand total', value: formatCurrency(grandTotal) },
    { label: 'Paid', value: formatCurrency(amountPaid) },
    { label: 'Outstanding', value: formatCurrency(balanceDue) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{invoice.invoiceNumber}</h1>
            <Badge variant="secondary" className={INVOICE_STATUS_CLASSES[invoice.status]}>
              {INVOICE_STATUS_LABELS[invoice.status]}
            </Badge>
            <Badge variant="secondary" className={PAYMENT_STATUS_CLASSES[invoice.paymentStatus]}>
              {PAYMENT_STATUS_LABELS[invoice.paymentStatus]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/customers/${invoice.customer.id}`} className="text-primary hover:underline">
              {invoice.customer.customerName}
            </Link>{' '}
            · {formatDate(invoice.invoiceDate)}
            {invoice.dueDate ? ` · due ${formatDate(invoice.dueDate)}` : ''}
          </p>
        </div>
        <InvoiceDetailActions
          invoiceId={invoice.id}
          status={invoice.status}
          balanceDue={balanceDue}
          canPost={hasPermission(user, 'invoice.post')}
          canCancel={hasPermission(user, 'invoice.cancel')}
          canPrint={hasPermission(user, 'invoice.print')}
          canRecordPayment={hasPermission(user, 'payment.create')}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-6">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="overflow-x-auto rounded-lg border">
        <table className="w-full text-sm">
          <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
            <tr>
              <th className="px-3 py-2 font-medium">#</th>
              <th className="px-3 py-2 font-medium">Item</th>
              <th className="px-3 py-2 font-medium">HSN</th>
              <th className="px-3 py-2 font-medium">Qty</th>
              <th className="px-3 py-2 font-medium">Rate</th>
              <th className="px-3 py-2 font-medium">Taxable</th>
              <th className="px-3 py-2 font-medium">GST</th>
              <th className="px-3 py-2 text-right font-medium">Amount</th>
            </tr>
          </thead>
          <tbody className="divide-y">
            {invoice.items.map((item, i) => (
              <tr key={item.id}>
                <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                <td className="px-3 py-2 font-medium">{item.productName}</td>
                <td className="px-3 py-2 text-muted-foreground">{item.hsnCode ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums">
                  {item.quantity.toNumber()} {item.unit}
                </td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(item.unitPrice.toNumber())}</td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(item.taxableValue.toNumber())}</td>
                <td className="px-3 py-2 tabular-nums">
                  {item.gstPercentage.toNumber()}% ({formatCurrency(item.gstAmount.toNumber())})
                </td>
                <td className="px-3 py-2 text-right font-medium tabular-nums">
                  {formatCurrency(item.lineTotal.toNumber())}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {invoice.payments.length > 0 && (
        <div>
          <h2 className="mb-2 text-sm font-semibold">Payments</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
                <tr>
                  <th className="px-3 py-2 font-medium">Payment #</th>
                  <th className="px-3 py-2 font-medium">Date</th>
                  <th className="px-3 py-2 font-medium">Method</th>
                  <th className="px-3 py-2 font-medium">Reference</th>
                  <th className="px-3 py-2 text-right font-medium">Amount</th>
                </tr>
              </thead>
              <tbody className="divide-y">
                {invoice.payments.map((p) => (
                  <tr key={p.id}>
                    <td className="px-3 py-2 font-medium">{p.paymentNumber}</td>
                    <td className="px-3 py-2 text-muted-foreground">{formatDate(p.paymentDate)}</td>
                    <td className="px-3 py-2">{p.paymentMethod}</td>
                    <td className="px-3 py-2 text-muted-foreground">{p.referenceNumber ?? '—'}</td>
                    <td className="px-3 py-2 text-right tabular-nums text-green-600">
                      {formatCurrency(p.amount.toNumber())}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
