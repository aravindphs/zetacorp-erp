import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { hasPermission, requirePermission } from '@/lib/auth/guards';
import { Badge } from '@/components/ui/badge';
import { Card, CardContent } from '@/components/ui/card';
import { getExpenseDetail } from '@/features/expense/expense.queries';
import { canActOnApproval, getApprovalTimeline } from '@/services/approval.service';
import { ExpenseDetailActions } from '@/features/expense/components/expense-detail-actions';
import { ExpenseReceipts } from '@/features/expense/components/expense-receipts';
import {
  EXPENSE_STATUS_CLASSES,
  EXPENSE_STATUS_LABELS,
  REIMBURSEMENT_METHOD_LABELS,
} from '@/features/expense/expense.types';
import { formatCurrency, formatDate, formatDateTime } from '@/utils/format';

export const metadata: Metadata = { title: 'Expense' };

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <tr>
      <td className="w-1/3 bg-muted/30 px-3 py-2 font-medium text-muted-foreground">{label}</td>
      <td className="px-3 py-2">{value ?? '—'}</td>
    </tr>
  );
}

export default async function ExpenseDetailPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await requirePermission('expense.view');
  const { id } = await params;
  const expense = await getExpenseDetail(id);
  if (!expense) notFound();

  // The engine decides whether this user approves *this* claim (§307).
  const [timeline, canDecide] = await Promise.all([
    expense.approvalRequestId
      ? getApprovalTimeline(expense.approvalRequestId)
      : Promise.resolve([]),
    expense.approvalRequestId
      ? canActOnApproval(expense.approvalRequestId, user)
      : Promise.resolve(false),
  ]);

  const isOwner = expense.employeeId === user.id;
  const amount = expense.amount.toNumber();

  const cards = [
    { label: 'Amount', value: formatCurrency(amount) },
    { label: 'Category', value: expense.category.name },
    { label: 'Expense date', value: formatDate(expense.expenseDate) },
    { label: 'Approval', value: EXPENSE_STATUS_LABELS[expense.status] },
    {
      label: 'Reimbursed',
      value: expense.reimbursedAt ? formatDate(expense.reimbursedAt) : 'Not yet',
    },
  ];

  return (
    <div className="space-y-6">
      <div className="flex flex-col justify-between gap-4 sm:flex-row sm:items-start">
        <div className="space-y-1">
          <div className="flex flex-wrap items-center gap-2">
            <h1 className="text-2xl font-semibold tracking-tight">{expense.expenseNumber}</h1>
            <Badge variant="secondary" className={EXPENSE_STATUS_CLASSES[expense.status]}>
              {EXPENSE_STATUS_LABELS[expense.status]}
            </Badge>
          </div>
          <p className="text-sm text-muted-foreground">
            <Link
              href={`/workforce/employees/${expense.employee.id}`}
              className="text-primary hover:underline"
            >
              {expense.employee.fullName}
            </Link>{' '}
            · {expense.employee.employeeCode} · {expense.category.name}
          </p>
        </div>
        <ExpenseDetailActions
          expenseId={expense.id}
          status={expense.status}
          amount={amount}
          isOwner={isOwner}
          canApprove={hasPermission(user, 'expense.approve')}
          canReject={hasPermission(user, 'expense.reject')}
          canReimburse={hasPermission(user, 'expense.reimburse')}
          canDecide={canDecide}
        />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-3 xl:grid-cols-5">
        {cards.map((c) => (
          <Card key={c.label}>
            <CardContent className="p-4">
              <p className="text-xs text-muted-foreground">{c.label}</p>
              <p className="mt-1 truncate text-lg font-semibold">{c.value}</p>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid gap-6 lg:grid-cols-2">
        <div>
          <h2 className="mb-2 text-sm font-semibold">Claim details</h2>
          <div className="overflow-x-auto rounded-lg border">
            <table className="w-full text-sm">
              <tbody className="divide-y">
                <Row label="Amount" value={formatCurrency(amount)} />
                <Row label="Currency" value={expense.currency} />
                <Row label="Category" value={expense.category.name} />
                <Row label="Expense date" value={formatDate(expense.expenseDate)} />
                <Row label="Vendor" value={expense.vendorName ?? '—'} />
                <Row label="Reference" value={expense.referenceNumber ?? '—'} />
                <Row label="Description" value={expense.description ?? '—'} />
                <Row label="Department" value={expense.employee.department?.name ?? '—'} />
                {expense.remarks && <Row label="Remarks" value={expense.remarks} />}
                {expense.approvalRemarks && (
                  <Row label="Approval remarks" value={expense.approvalRemarks} />
                )}
              </tbody>
            </table>
          </div>

          {/* Reimbursement + ledger entry (§308, §311) */}
          {expense.status === 'REIMBURSED' && (
            <>
              <h2 className="mb-2 mt-6 text-sm font-semibold">Reimbursement</h2>
              <div className="overflow-x-auto rounded-lg border">
                <table className="w-full text-sm">
                  <tbody className="divide-y">
                    <Row label="Paid on" value={formatDate(expense.reimbursedAt)} />
                    <Row
                      label="Method"
                      value={
                        expense.reimbursementMethod
                          ? REIMBURSEMENT_METHOD_LABELS[expense.reimbursementMethod]
                          : '—'
                      }
                    />
                    <Row label="Reference" value={expense.reimbursementReference ?? '—'} />
                    <Row label="Remarks" value={expense.reimbursementRemarks ?? '—'} />
                    {expense.transactions[0] && (
                      <Row
                        label="Financial transaction"
                        value={expense.transactions[0].transactionNumber}
                      />
                    )}
                  </tbody>
                </table>
              </div>
            </>
          )}
        </div>

        {/* Approval timeline (§306) */}
        <div>
          <h2 className="mb-2 text-sm font-semibold">Approval timeline</h2>
          {timeline.length === 0 ? (
            <p className="rounded-lg border p-4 text-sm text-muted-foreground">
              {expense.status === 'PENDING'
                ? 'Awaiting a decision from an approver.'
                : 'No approval activity recorded.'}
            </p>
          ) : (
            <ol className="space-y-3 rounded-lg border p-4">
              {timeline.map((entry) => (
                <li key={entry.id} className="flex gap-3">
                  <span
                    className={`mt-1.5 size-2 shrink-0 rounded-full ${
                      entry.action === 'APPROVED'
                        ? 'bg-green-500'
                        : entry.action === 'REJECTED'
                          ? 'bg-destructive'
                          : 'bg-muted-foreground'
                    }`}
                  />
                  <div className="min-w-0">
                    <p className="text-sm">
                      <span className="font-medium">{entry.stepName}</span> ·{' '}
                      {entry.action.toLowerCase()} by {entry.actorName}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {formatDateTime(entry.createdAt)}
                    </p>
                    {entry.remarks && <p className="mt-1 text-sm">{entry.remarks}</p>}
                  </div>
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>

      {/* Receipts (§305) — attachable only while the claim is undecided. */}
      <ExpenseReceipts
        expenseId={expense.id}
        receipts={expense.receipts.map((r) => ({
          id: r.id,
          receiptType: r.receiptType,
          fileName: r.fileName,
          mimeType: r.mimeType,
          fileSize: r.fileSize,
          createdAt: r.createdAt.toISOString(),
        }))}
        canManage={isOwner && (expense.status === 'DRAFT' || expense.status === 'PENDING')}
      />
    </div>
  );
}
