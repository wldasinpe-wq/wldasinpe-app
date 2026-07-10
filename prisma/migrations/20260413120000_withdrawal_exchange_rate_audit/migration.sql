-- AlterTable
ALTER TABLE "withdrawals" ADD COLUMN "exchange_rate_source" TEXT,
ADD COLUMN "exchange_rate_fetched_at" TIMESTAMP(3);
