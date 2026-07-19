import type { Metadata } from 'next';
import { notFound } from 'next/navigation';
import { FileText, Pencil, ReceiptText, Wallet } from 'lucide-react';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { ButtonLink } from '@/components/shared/button-link';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getCustomerProfileOrThrow } from '@/features/customer/customer.service';
import {
  getCustomerLedger,
  getCustomerRelatedLists,
  getCustomerSummary,
  getCustomerTimeline,
} from '@/features/customer/customer.queries';
import { listCustomerNotes } from '@/features/customer/customer.notes.service';
import { CustomerDetailTabs } from '@/features/customer/components/customer-detail-tabs';
import {
  CUSTOMER_STATUS_CLASSES,
  CUSTOMER_STATUS_LABELS,
} from '@/features/customer/customer.types';
import { formatCurrency, formatDate } from '@/utils/format';

export const metadata: Metadata = { title: 'Customer' };

export default async function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requirePermission('customer.view');
  const { id } = await params;

  const customer = await getCustomerProfileOrThrow(id).catch(() => null);
  if (!customer) notFound();

  const canLedger = hasPermission(user, 'customer.ledger');
  const canNotes = hasPermission(user, 'customer.notes');
  const canTimeline = hasPermission(user, 'customer.timeline');

  const [summary, lists, ledger, timeline, notes] = await Promise.all([
    getCustomerSummary(customer.id, customer.createdAt),
    getCustomerRelatedLists(customer.id),
    canLedger ? getCustomerLedger(customer.id) : Promise.resolve(null),
    canTimeline ? getCustomerTimeline(customer.id) : Promise.resolve(null),
    canNotes ? listCustomerNotes(customer.id) : Promise.resolve(null),
  ]);

  const summaryCards = [
    { label: 'Quotations', value: String(summary.totalQuotations) },
    { label: 'Invoices', value: String(summary.totalInvoices) },
    { label: 'Total revenue', value: formatCurrency(summary.totalRevenue) },
    { label: 'Outstanding', value: formatCurrency(summary.outstanding) },
    { label: 'Avg invoice', value: formatCurrency(summary.averageInvoiceValue) },
    {
      label: 'Last purchase',
      value: summary.lastPurchaseDate ? formatDate(summary.lastPurchaseDate) : '—',
    },
    { label: 'Customer since', value: formatDate(summary.customerSince) },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex items-center gap-3">
            <h1 className="text-2xl font-semibold tracking-tight">{customer.customerName}</h1>
            <Badge variant="secondary" className={CUSTOMER_STATUS_CLASSES[customer.status]}>
              {CUSTOMER_STATUS_LABELS[customer.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            {customer.customerCode}
            {customer.companyName ? ` · ${customer.companyName}` : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {hasPermission(user, 'customer.update') && (
            <ButtonLink href={`/customers/${customer.id}/edit`} variant="outline" size="sm">
              <Pencil className="size-4" /> Edit
            </ButtonLink>
          )}
          {hasPermission(user, 'quotation.create') && (
            <ButtonLink href={`/quotations/new?customerId=${customer.id}`} variant="outline" size="sm">
              <FileText className="size-4" /> Quotation
            </ButtonLink>
          )}
          {hasPermission(user, 'invoice.create') && (
            <ButtonLink href={`/invoices/new?customerId=${customer.id}`} variant="outline" size="sm">
              <ReceiptText className="size-4" /> Invoice
            </ButtonLink>
          )}
          {hasPermission(user, 'payment.create') && (
            <ButtonLink href={`/payments/new?customerId=${customer.id}`} variant="outline" size="sm">
              <Wallet className="size-4" /> Payment
            </ButtonLink>
          )}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4 xl:grid-cols-7">
        {summaryCards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold tabular-nums">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <CustomerDetailTabs
        customerId={customer.id}
        overview={{
          customerType: customer.customerType,
          companyName: customer.companyName,
          phone: customer.phone,
          alternatePhone: customer.alternatePhone,
          email: customer.email,
          website: customer.website,
          gstNumber: customer.gstNumber,
          panNumber: customer.panNumber,
          aadhaarNumber: customer.aadhaarNumber,
          industry: customer.industry,
          businessSize: customer.businessSize,
          paymentTermsDays: customer.paymentTermsDays,
          creditLimit: customer.creditLimit.toNumber(),
          preferredContactMethod: customer.preferredContactMethod,
          outstanding: summary.outstanding,
        }}
        addresses={customer.addresses.map((a) => ({
          id: a.id,
          addressType: a.addressType,
          addressLine1: a.addressLine1,
          addressLine2: a.addressLine2,
          city: a.city,
          district: a.district,
          state: a.state,
          postalCode: a.postalCode,
          country: a.country,
          isDefault: a.isDefault,
        }))}
        lists={lists}
        ledger={ledger}
        timeline={timeline}
        notes={notes}
        currentUserName={user.fullName}
        canLedger={canLedger}
        canNotes={canNotes}
        canTimeline={canTimeline}
      />
    </div>
  );
}
