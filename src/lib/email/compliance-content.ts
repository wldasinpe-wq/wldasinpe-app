import type { Withdrawal } from '@prisma/client';

/** Fields required to build the Ridivi / internal compliance notification (plain text). */
export type WithdrawalComplianceEmailInput = {
  referenceId: string;
  walletAddress: string;
  phoneNumber: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  amountWld: string;
  /** Estimated net CRC (label clearly in body). */
  amountCrcEstimated: string;
  exchangeRateCrcPerWld: string;
  commissionCrc: string;
  transactionId: string | null;
  txHash: string | null;
};

export function appEnvironmentLabel(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

export function withdrawalToComplianceInput(
  row: Withdrawal
): WithdrawalComplianceEmailInput {
  return {
    referenceId: row.referenceId,
    walletAddress: row.walletAddress,
    phoneNumber: row.phoneNumber,
    accountNumber: row.accountNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    idNumber: row.idNumber,
    amountWld: row.amountWld.toString(),
    amountCrcEstimated: row.amountCrc.toString(),
    exchangeRateCrcPerWld: row.exchangeRate.toString(),
    commissionCrc: row.commissionCrc.toString(),
    transactionId: row.transactionId,
    txHash: row.txHash,
  };
}

export function buildComplianceEmailSubject(referenceId: string): string {
  return `[Ridivi withdraw] ${referenceId}`;
}

/**
 * Body aligned with docs/INFRA_RECOMMENDATIONS.md + docs/WITHDRAWAL_STEPS.md (minimum fields + context).
 */
export function buildComplianceEmailPlainText(
  input: WithdrawalComplianceEmailInput,
  timestampUtc: Date
): string {
  const ts = timestampUtc.toISOString();
  const lines = [
    `reference_id: ${input.referenceId}`,
    `wallet_address: ${input.walletAddress}`,
    `sinpe_phone: ${input.phoneNumber}`,
    `account_number: ${input.accountNumber}`,
    `legal_name: ${input.firstName} ${input.lastName}`.trim(),
    `id_number: ${input.idNumber}`,
    `amount_wld: ${input.amountWld}`,
    `amount_crc_estimated_net: ${input.amountCrcEstimated}`,
    `exchange_rate_crc_per_wld: ${input.exchangeRateCrcPerWld}`,
    `commission_crc: ${input.commissionCrc}`,
    `transaction_id: ${input.transactionId ?? '(pending)'}`,
    `tx_hash: ${input.txHash ?? '(pending)'}`,
    `timestamp_utc: ${ts}`,
    `environment: ${appEnvironmentLabel()}`,
    '',
    'Internal record only — not an official compliance submission.',
  ];
  return lines.join('\n');
}
