import 'server-only';

/**
 * Financial Engine ledger (spec: Module 6 "Financial Engine" block, §311).
 *
 * Append-only double-entry style records for every money event: an invoice
 * being posted, a payment being received, and an expense being reimbursed.
 * Entries are never edited or deleted — corrections are new entries.
 *
 * Sign convention matches the customer ledger (`getCustomerLedger`):
 *   invoice posted    → DEBIT  (the customer owes more)
 *   payment received  → CREDIT (the customer owes less)
 *   expense reimbursed→ DEBIT  (money paid out)
 *
 * `balance` is the running customer balance after the entry, so a customer's
 * statement can be read straight off the ledger without recomputation. Entries
 * with no customer (expense reimbursements) carry the entry's own net effect.
 *
 * Every writer MUST pass its transaction client so the ledger row commits (or
 * rolls back) atomically with the event that caused it.
 */
import { Prisma, type FinancialTransactionType } from '@prisma/client';
import { generateCode } from '@/lib/code-generator';

export interface RecordTransactionInput {
  type: FinancialTransactionType;
  /** Money in from the customer's perspective (increases what they owe). */
  debit?: Prisma.Decimal | number;
  /** Money out (reduces what they owe). */
  credit?: Prisma.Decimal | number;
  customerId?: string | null;
  invoiceId?: string | null;
  paymentId?: string | null;
  expenseId?: string | null;
  reference?: string | null;
  userId: string;
  /** Defaults to now; pass the business date where one exists. */
  occurredAt?: Date;
}

/** Most recent running balance for a customer, or 0 when they have none yet. */
async function previousCustomerBalance(
  tx: Prisma.TransactionClient,
  customerId: string,
): Promise<Prisma.Decimal> {
  const last = await tx.financialTransaction.findFirst({
    where: { customerId },
    orderBy: { createdAt: 'desc' },
    select: { balance: true },
  });
  return last?.balance ?? new Prisma.Decimal(0);
}

export async function recordFinancialTransaction(
  tx: Prisma.TransactionClient,
  input: RecordTransactionInput,
): Promise<{ transactionNumber: string; balance: Prisma.Decimal }> {
  const debit = new Prisma.Decimal(input.debit ?? 0);
  const credit = new Prisma.Decimal(input.credit ?? 0);
  const occurredAt = input.occurredAt ?? new Date();

  const balance = input.customerId
    ? (await previousCustomerBalance(tx, input.customerId)).plus(debit).minus(credit)
    : debit.minus(credit);

  const transactionNumber = await generateCode(tx, {
    key: `financial_txn:${occurredAt.getFullYear()}`,
    prefix: `FTX-${occurredAt.getFullYear()}`,
  });

  await tx.financialTransaction.create({
    data: {
      transactionNumber,
      transactionType: input.type,
      customerId: input.customerId ?? null,
      invoiceId: input.invoiceId ?? null,
      paymentId: input.paymentId ?? null,
      expenseId: input.expenseId ?? null,
      debit,
      credit,
      balance,
      reference: input.reference ?? null,
      createdBy: input.userId,
    },
  });

  return { transactionNumber, balance };
}
