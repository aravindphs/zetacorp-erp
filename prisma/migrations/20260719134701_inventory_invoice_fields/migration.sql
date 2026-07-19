-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.
ALTER TYPE "InventoryTransactionType" ADD VALUE 'DAMAGE';
ALTER TYPE "InventoryTransactionType" ADD VALUE 'RETURN';
-- AlterTable
ALTER TABLE "invoice_items" ADD COLUMN     "gst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "hsn_code" TEXT,
ADD COLUMN     "product_name" TEXT NOT NULL,
ADD COLUMN     "taxable_value" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "unit" TEXT NOT NULL DEFAULT 'Nos',
ALTER COLUMN "description" DROP NOT NULL;
-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "cgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "igst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "place_of_supply" TEXT,
ADD COLUMN     "reference_number" TEXT,
ADD COLUMN     "reverse_charge" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "round_off" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "sgst_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "taxable_amount" DECIMAL(14,2) NOT NULL DEFAULT 0,
ADD COLUMN     "terms_conditions" TEXT;
-- AlterTable
ALTER TABLE "products" ADD COLUMN     "datasheet_url" TEXT,
ADD COLUMN     "discount_percentage" DECIMAL(5,2) NOT NULL DEFAULT 0,
ADD COLUMN     "image_url" TEXT,
ADD COLUMN     "maximum_stock" DECIMAL(14,3),
ADD COLUMN     "minimum_selling_price" DECIMAL(14,2),
ADD COLUMN     "mrp" DECIMAL(14,2),
ADD COLUMN     "reorder_level" DECIMAL(14,3),
ADD COLUMN     "sku" TEXT;
-- CreateIndex
CREATE UNIQUE INDEX "products_sku_key" ON "products"("sku");
