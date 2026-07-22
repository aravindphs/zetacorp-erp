-- CreateTable
CREATE TABLE "announcement_acknowledgements" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "announcement_id" UUID NOT NULL,
    "user_id" UUID NOT NULL,
    "acknowledged_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "announcement_acknowledgements_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "announcement_acknowledgements_user_id_idx" ON "announcement_acknowledgements"("user_id");

-- CreateIndex
CREATE INDEX "announcement_acknowledgements_announcement_id_idx" ON "announcement_acknowledgements"("announcement_id");

-- CreateIndex
CREATE UNIQUE INDEX "announcement_acknowledgements_announcement_id_user_id_key" ON "announcement_acknowledgements"("announcement_id", "user_id");

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_announcement_id_fkey" FOREIGN KEY ("announcement_id") REFERENCES "announcements"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "announcement_acknowledgements" ADD CONSTRAINT "announcement_acknowledgements_user_id_fkey" FOREIGN KEY ("user_id") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;
