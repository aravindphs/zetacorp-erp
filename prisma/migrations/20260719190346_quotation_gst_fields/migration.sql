-- AlterTable
ALTER TABLE "quotation_items" ADD COLUMN     "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "taxable_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'Nos',
ALTER COLUMN "description" DROP NOT NULL;
-- AlterTable
ALTER TABLE "quotations" ADD COLUMN     "cancel_reason" TEXT,
ADD COLUMN     "cancelled_at" TIMESTAMPTZ(6),
ADD COLUMN     "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "duplicated_from_id" UUID,
ADD COLUMN     "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "place_of_supply" TEXT,
ADD COLUMN     "reference_number" TEXT,
ADD COLUMN     "round_off" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sent_at" TIMESTAMPTZ(6),
ADD COLUMN     "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0;
