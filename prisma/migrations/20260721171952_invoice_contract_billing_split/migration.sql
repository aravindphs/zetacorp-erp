-- CreateEnum
CREATE TYPE "InvoiceBillingType" AS ENUM ('ITEMIZED', 'SPLIT', 'MATERIALS_ONLY');

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "billing_type" "InvoiceBillingType" NOT NULL DEFAULT 'ITEMIZED',
ADD COLUMN     "contract_value" DECIMAL(14,2),
ADD COLUMN     "goods_description" TEXT,
ADD COLUMN     "goods_gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 5,
ADD COLUMN     "goods_hsn_code" TEXT DEFAULT '8541',
ADD COLUMN     "goods_ratio" DECIMAL(5,2) NOT NULL DEFAULT 70,
ADD COLUMN     "is_tax_inclusive" BOOLEAN NOT NULL DEFAULT true,
ADD COLUMN     "service_description" TEXT,
ADD COLUMN     "service_gst_percentage" DECIMAL(5,2) NOT NULL DEFAULT 18,
ADD COLUMN     "service_sac_code" TEXT DEFAULT '9954';
