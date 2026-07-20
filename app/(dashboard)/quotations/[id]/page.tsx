import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getQuotationDetail } from '@/features/quotation/quotation.queries';
import { QuotationDetailActions } from '@/features/quotation/components/quotation-detail-actions';
import {
  QUOTATION_STATUS_CLASSES,
  QUOTATION_STATUS_LABELS,
} from '@/features/quotation/quotation.types';
import { formatCurrency, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Quotation' };

export default async function QuotationDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('quotation.view');
  const { id } = await params;
  const q = await getQuotationDetail(id);
  if (!q) notFound();

  const cards = [
    { label: 'Items', value: String(q.items.length) },
    { label: 'Subtotal', value: formatCurrency(q.subtotal.toNumber()) },
    { label: 'Taxable', value: formatCurrency(q.taxableAmount.toNumber()) },
    { label: 'GST', value: formatCurrency(q.gstAmount.toNumber()) },
    { label: 'Grand total', value: formatCurrency(q.grandTotal.toNumber()) },
    { label: 'Valid until', value: q.validUntil ? formatDate(q.validUntil) : '—' },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{q.quotationNumber}</h1>
            <Badge variant="secondary" className={QUOTATION_STATUS_CLASSES[q.status]}>
              {QUOTATION_STATUS_LABELS[q.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link href={`/customers/${q.customer.id}`} className="text-primary hover:underline">
              {q.customer.customerName}
            </Link>{' '}
            · {formatDate(q.quotationDate)}
          </p>
        </div>
        <QuotationDetailActions
          quotationId={q.id}
          status={q.status}
          perms={{
            update: hasPermission(user, 'quotation.update'),
            cancel: hasPermission(user, 'quotation.cancel'),
            duplicate: hasPermission(user, 'quotation.duplicate'),
            convert: hasPermission(user, 'quotation.convert'),
            print: hasPermission(user, 'quotation.print'),
          }}
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
            {q.items.map((item, i) => (
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

      {q.termsConditions && (
        <div className="rounded-lg border p-4 text-sm">
          <p className="mb-1 font-medium">Terms &amp; conditions</p>
          <p className="whitespace-pre-wrap text-muted-foreground">{q.termsConditions}</p>
        </div>
      )}
    </div>
  );
}
