-- CreateEnum
CREATE TYPE "WithdrawalStatus" AS ENUM ('PENDING_PAYMENT', 'SUBMITTED', 'EMAILED', 'FAILED');

-- CreateTable
CREATE TABLE "withdrawals" (
    "id" TEXT NOT NULL,
    "reference_id" TEXT NOT NULL,
    "wallet_address" TEXT NOT NULL,
    "first_name" TEXT NOT NULL,
    "last_name" TEXT NOT NULL,
    "id_number" TEXT NOT NULL,
    "phone_number" TEXT NOT NULL,
    "account_number" TEXT NOT NULL,
    "amount_wld" DECIMAL(20,8) NOT NULL,
    "amount_crc" DECIMAL(20,4) NOT NULL,
    "exchange_rate" DECIMAL(20,8) NOT NULL,
    "commission_crc" DECIMAL(20,4) NOT NULL,
    "transaction_id" TEXT,
    "tx_hash" TEXT,
    "status" "WithdrawalStatus" NOT NULL DEFAULT 'PENDING_PAYMENT',
    "last_error" TEXT,
    "id_front_submitted" BOOLEAN NOT NULL DEFAULT false,
    "id_back_submitted" BOOLEAN NOT NULL DEFAULT false,
    "id_submitted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "withdrawals_pkey" PRIMARY KEY ("id")
);

CREATE UNIQUE INDEX "withdrawals_reference_id_key" ON "withdrawals"("reference_id");

CREATE INDEX "withdrawals_wallet_address_idx" ON "withdrawals"("wallet_address");
