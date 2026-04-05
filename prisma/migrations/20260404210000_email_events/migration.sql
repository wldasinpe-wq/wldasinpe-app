-- CreateEnum
CREATE TYPE "EmailEventStatus" AS ENUM ('QUEUED', 'SENT', 'FAILED', 'SKIPPED');

-- CreateTable
CREATE TABLE "email_events" (
    "id" TEXT NOT NULL,
    "withdrawal_id" TEXT,
    "reference_id" TEXT NOT NULL,
    "kind" TEXT NOT NULL DEFAULT 'withdrawal_compliance',
    "status" "EmailEventStatus" NOT NULL,
    "provider" TEXT NOT NULL DEFAULT 'resend',
    "provider_message_id" TEXT,
    "error_message" TEXT,
    "to_address" TEXT NOT NULL,
    "from_address" TEXT NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "email_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "email_events_reference_id_idx" ON "email_events"("reference_id");

-- CreateIndex
CREATE INDEX "email_events_withdrawal_id_idx" ON "email_events"("withdrawal_id");

-- AddForeignKey
ALTER TABLE "email_events" ADD CONSTRAINT "email_events_withdrawal_id_fkey" FOREIGN KEY ("withdrawal_id") REFERENCES "withdrawals"("id") ON DELETE SET NULL ON UPDATE CASCADE;
