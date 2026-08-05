-- Drop persisted commission estimate; fees are shown in UI only (Ridivi settles final amounts).
ALTER TABLE "withdrawals" DROP COLUMN "commission_crc";
