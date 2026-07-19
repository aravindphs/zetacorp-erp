'use client';

import Link from 'next/link';
import type { ReactNode } from 'react';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { EmptyState } from '@/components/shared/page-states';
import { formatCurrency, formatDate } from '@/utils/format';
import { NotesTab } from '@/features/customer/components/notes-tab';
import { CUSTOMER_TYPE_LABELS } from '@/features/customer/customer.types';
import type {
  CustomerRelatedLists,
  LedgerEntry,
  TimelineEvent,
} from '@/features/customer/customer.queries';
import type { AddressType, ContactMethod, CustomerType } from '@prisma/client';

interface OverviewData {
  customerType: CustomerType;
  companyName: string | null;
  phone: string;
  alternatePhone: string | null;
  email: string | null;
  website: string | null;
  gstNumber: string | null;
  panNumber: string | null;
  aadhaarNumber: string | null;
  industry: string | null;
  businessSize: string | null;
  paymentTermsDays: number | null;
  creditLimit: number;
  preferredContactMethod: ContactMethod | null;
  outstanding: number;
}

interface AddressData {
  id: string;
  addressType: AddressType;
  addressLine1: string;
  addressLine2: string | null;
  city: string;
  district: string | null;
  state: string;
  postalCode: string;
  country: string;
  isDefault: boolean;
}

interface Note {
  id: string;
  content: string;
  author: string;
  createdAt: string;
  edited: boolean;
}

function Row({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex justify-between gap-4 border-b py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{label}</span>
      <span className="text-right font-medium">{children ?? '—'}</span>
    </div>
  );
}

function MiniTable({ headers, children }: { headers: string[]; children: ReactNode }) {
  return (
    <div className="overflow-x-auto rounded-lg border">
      <table className="w-full text-sm">
        <thead className="bg-muted/50 text-left text-xs text-muted-foreground">
          <tr>
            {headers.map((h) => (
              <th key={h} className="px-3 py-2 font-medium">
                {h}
              </th>
            ))}
          </tr>
        </thead>
        <tbody className="divide-y">{children}</tbody>
      </table>
    </div>
  );
}

export function CustomerDetailTabs({
  customerId,
  overview,
  addresses,
  lists,
  ledger,
  timeline,
  notes,
  currentUserName,
  canLedger,
  canNotes,
  canTimeline,
}: {
  customerId: string;
  overview: OverviewData;
  addresses: AddressData[];
  lists: CustomerRelatedLists;
  ledger: LedgerEntry[] | null;
  timeline: TimelineEvent[] | null;
  notes: Note[] | null;
  currentUserName: string;
  canLedger: boolean;
  canNotes: boolean;
  canTimeline: boolean;
}) {
  return (
    <Tabs defaultValue="overview" className="w-full">
      <TabsList className="flex-wrap">
        <TabsTrigger value="overview">Overview</TabsTrigger>
        <TabsTrigger value="addresses">Addresses</TabsTrigger>
        <TabsTrigger value="quotations">Quotations</TabsTrigger>
        <TabsTrigger value="invoices">Invoices</TabsTrigger>
        <TabsTrigger value="payments">Payments</TabsTrigger>
        {canLedger && <TabsTrigger value="ledger">Ledger</TabsTrigger>}
        {canNotes && <TabsTrigger value="notes">Notes</TabsTrigger>}
        {canTimeline && <TabsTrigger value="timeline">Timeline</TabsTrigger>}
      </TabsList>

      <TabsContent value="overview" className="mt-4 grid gap-6 md:grid-cols-2">
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Contact & identity</h3>
          <Row label="Type">{CUSTOMER_TYPE_LABELS[overview.customerType]}</Row>
          <Row label="Company">{overview.companyName}</Row>
          <Row label="Phone">{overview.phone}</Row>
          <Row label="Alternate phone">{overview.alternatePhone}</Row>
          <Row label="Email">{overview.email}</Row>
          <Row label="Website">{overview.website}</Row>
          <Row label="GST">{overview.gstNumber}</Row>
          <Row label="PAN">{overview.panNumber}</Row>
          <Row label="Aadhaar">{overview.aadhaarNumber}</Row>
        </div>
        <div className="rounded-lg border p-4">
          <h3 className="mb-2 font-medium">Business</h3>
          <Row label="Industry">{overview.industry}</Row>
          <Row label="Business size">{overview.businessSize}</Row>
          <Row label="Payment terms">
            {overview.paymentTermsDays != null ? `${overview.paymentTermsDays} days` : null}
          </Row>
          <Row label="Credit limit">{formatCurrency(overview.creditLimit)}</Row>
          <Row label="Preferred contact">{overview.preferredContactMethod}</Row>
          <Row label="Outstanding">{formatCurrency(overview.outstanding)}</Row>
        </div>
      </TabsContent>

      <TabsContent value="addresses" className="mt-4">
        {addresses.length === 0 ? (
          <EmptyState title="No addresses" description="No addresses recorded for this customer." />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2">
            {addresses.map((a) => (
              <div key={a.id} className="rounded-lg border p-4 text-sm">
                <div className="mb-1 flex items-center gap-2">
                  <Badge variant="secondary">{a.addressType}</Badge>
                  {a.isDefault && <Badge variant="outline">Default</Badge>}
                </div>
                <p>{a.addressLine1}</p>
                {a.addressLine2 && <p>{a.addressLine2}</p>}
                <p>
                  {a.city}
                  {a.district ? `, ${a.district}` : ''}, {a.state} {a.postalCode}
                </p>
                <p className="text-muted-foreground">{a.country}</p>
              </div>
            ))}
          </div>
        )}
      </TabsContent>

      <TabsContent value="quotations" className="mt-4">
        {lists.quotations.length === 0 ? (
          <EmptyState title="No quotations" description="Quotations for this customer will appear here." />
        ) : (
          <MiniTable headers={['Number', 'Status', 'Amount', 'Date']}>
            {lists.quotations.map((q) => (
              <tr key={q.id}>
                <td className="px-3 py-2 font-medium">{q.number}</td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{q.status}</Badge>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(q.amount)}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(q.date)}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </TabsContent>

      <TabsContent value="invoices" className="mt-4">
        {lists.invoices.length === 0 ? (
          <EmptyState title="No invoices" description="Invoices for this customer will appear here." />
        ) : (
          <MiniTable headers={['Number', 'Total', 'Paid', 'Outstanding', 'Status', 'Date']}>
            {lists.invoices.map((i) => (
              <tr key={i.id}>
                <td className="px-3 py-2 font-medium">
                  <Link href={`/invoices/${i.id}`} className="text-primary hover:underline">
                    {i.number}
                  </Link>
                </td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(i.total)}</td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(i.paid)}</td>
                <td className="px-3 py-2 tabular-nums">{formatCurrency(i.outstanding)}</td>
                <td className="px-3 py-2">
                  <Badge variant="secondary">{i.status}</Badge>
                </td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(i.date)}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </TabsContent>

      <TabsContent value="payments" className="mt-4">
        {lists.payments.length === 0 ? (
          <EmptyState title="No payments" description="Payments from this customer will appear here." />
        ) : (
          <MiniTable headers={['Number', 'Method', 'Reference', 'Amount', 'Date']}>
            {lists.payments.map((p) => (
              <tr key={p.id}>
                <td className="px-3 py-2 font-medium">{p.number}</td>
                <td className="px-3 py-2">{p.method}</td>
                <td className="px-3 py-2 text-muted-foreground">{p.reference ?? '—'}</td>
                <td className="px-3 py-2 tabular-nums text-green-600">{formatCurrency(p.amount)}</td>
                <td className="px-3 py-2 text-muted-foreground">{formatDate(p.date)}</td>
              </tr>
            ))}
          </MiniTable>
        )}
      </TabsContent>

      {canLedger && (
        <TabsContent value="ledger" className="mt-4">
          {!ledger || ledger.length === 0 ? (
            <EmptyState title="No ledger entries" description="Invoices and payments will build the ledger." />
          ) : (
            <MiniTable headers={['Date', 'Type', 'Reference', 'Debit', 'Credit', 'Balance']}>
              {ledger.map((e, i) => (
                <tr key={`${e.reference}-${i}`}>
                  <td className="px-3 py-2 text-muted-foreground">{formatDate(e.date)}</td>
                  <td className="px-3 py-2">{e.type}</td>
                  <td className="px-3 py-2 font-medium">{e.reference}</td>
                  <td className="px-3 py-2 tabular-nums">{e.debit ? formatCurrency(e.debit) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums">{e.credit ? formatCurrency(e.credit) : '—'}</td>
                  <td className="px-3 py-2 tabular-nums font-medium">{formatCurrency(e.balance)}</td>
                </tr>
              ))}
            </MiniTable>
          )}
        </TabsContent>
      )}

      {canNotes && (
        <TabsContent value="notes" className="mt-4">
          <NotesTab
            customerId={customerId}
            notes={notes ?? []}
            currentUserName={currentUserName}
            canManage
          />
        </TabsContent>
      )}

      {canTimeline && (
        <TabsContent value="timeline" className="mt-4">
          {!timeline || timeline.length === 0 ? (
            <EmptyState title="No activity yet" description="Customer events will appear here." />
          ) : (
            <ul className="space-y-3">
              {timeline.map((ev) => (
                <li key={ev.id} className="flex items-start gap-3 text-sm">
                  <span className="mt-1.5 size-1.5 shrink-0 rounded-full bg-primary" />
                  <div>
                    <p>
                      <span className="font-medium">{ev.label}</span>
                      {ev.detail && <span className="text-muted-foreground"> · {ev.detail}</span>}
                    </p>
                    <p className="text-xs text-muted-foreground">{formatDate(ev.date)}</p>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </TabsContent>
      )}
    </Tabs>
  );
}
