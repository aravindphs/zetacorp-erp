-- CreateEnum
CREATE TYPE "ExpenseReceiptType" AS ENUM ('INVOICE', 'BILL', 'RECEIPT', 'TRAVEL_TICKET', 'OTHER');

-- CreateEnum
CREATE TYPE "FinancialTransactionType" AS ENUM ('INVOICE_POSTED', 'PAYMENT_RECEIVED', 'EXPENSE_REIMBURSED', 'REFUND', 'CREDIT_NOTE');

-- AlterTable
ALTER TABLE "expenses" ADD COLUMN     "approval_request_id" UUID,
ADD COLUMN     "currency" TEXT NOT NULL DEFAULT 'INR',
ADD COLUMN     "description" TEXT,
ADD COLUMN     "reference_number" TEXT,
ADD COLUMN     "reimbursed_at" TIMESTAMPTZ(6),
ADD COLUMN     "reimbursed_by" UUID,
ADD COLUMN     "reimbursement_method" "PaymentMethod",
ADD COLUMN     "reimbursement_reference" TEXT,
ADD COLUMN     "reimbursement_remarks" TEXT,
ADD COLUMN     "vendor_name" TEXT;

-- CreateTable
CREATE TABLE "expense_receipts" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "expense_id" UUID NOT NULL,
    "receipt_type" "ExpenseReceiptType" NOT NULL DEFAULT 'RECEIPT',
    "file_name" TEXT NOT NULL,
    "storage_path" TEXT NOT NULL,
    "mime_type" TEXT NOT NULL,
    "file_size" INTEGER NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,
    "created_by" UUID,
    "updated_by" UUID,
    "deleted_at" TIMESTAMPTZ(6),
    "deleted_by" UUID,
    "is_deleted" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "expense_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "financial_transactions" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "transaction_number" TEXT NOT NULL,
    "transaction_type" "FinancialTransactionType" NOT NULL,
    "invoice_id" UUID,
    "payment_id" UUID,
    "customer_id" UUID,
    "expense_id" UUID,
    "debit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "credit" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "balance" DECIMAL(14,2) NOT NULL DEFAULT 0,
    "reference" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "created_by" UUID,

    CONSTRAINT "financial_transactions_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "expense_receipts_expense_id_idx" ON "expense_receipts"("expense_id");

-- CreateIndex
CREATE INDEX "expense_receipts_is_deleted_idx" ON "expense_receipts"("is_deleted");

-- CreateIndex
CREATE UNIQUE INDEX "financial_transactions_transaction_number_key" ON "financial_transactions"("transaction_number");

-- CreateIndex
CREATE INDEX "financial_transactions_transaction_number_idx" ON "financial_transactions"("transaction_number");

-- CreateIndex
CREATE INDEX "financial_transactions_transaction_type_idx" ON "financial_transactions"("transaction_type");

-- CreateIndex
CREATE INDEX "financial_transactions_invoice_id_idx" ON "financial_transactions"("invoice_id");

-- CreateIndex
CREATE INDEX "financial_transactions_payment_id_idx" ON "financial_transactions"("payment_id");

-- CreateIndex
CREATE INDEX "financial_transactions_customer_id_idx" ON "financial_transactions"("customer_id");

-- CreateIndex
CREATE INDEX "financial_transactions_expense_id_idx" ON "financial_transactions"("expense_id");

-- CreateIndex
CREATE INDEX "financial_transactions_created_at_idx" ON "financial_transactions"("created_at");

-- CreateIndex
CREATE INDEX "expenses_approval_request_id_idx" ON "expenses"("approval_request_id");

-- AddForeignKey
ALTER TABLE "expense_receipts" ADD CONSTRAINT "expense_receipts_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "financial_transactions" ADD CONSTRAINT "financial_transactions_expense_id_fkey" FOREIGN KEY ("expense_id") REFERENCES "expenses"("id") ON DELETE SET NULL ON UPDATE CASCADE;
