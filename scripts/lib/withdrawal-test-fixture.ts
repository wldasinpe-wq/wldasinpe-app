/**
 * Shared mock withdrawal data for `test:db-withdrawal` and `test:email-compliance`.
 * Edit here to keep both scripts aligned.
 */

import { Prisma } from '@prisma/client';

import type { WithdrawalComplianceEmailInput } from '../../src/lib/email/compliance-content';
import {
  calculateConversion,
  EXCHANGE_RATES,
} from '../../src/constants/exchange';

// =============================================================================
// Mock data — fictional persona, realistic formats (CR cédula, SINPE, IBAN, EVM).
// =============================================================================

export const WITHDRAWAL_TEST_MOCK = {
  useAutoReferenceId: true,

  referenceId: 'a7f3c9e12b804d65a1e24400b9c8d7e6',

  walletAddress: '0x4e62c0f6a8b1d3e59c7a2f084d51e6b93a7c40f2',

  identity: {
    firstName: 'Andrés',
    lastName: 'Mora Chavarría',
    idNumber: '1-0865-0427',
    phoneNumber: '84917263',
    accountNumber: 'CR05015202001026284066',
    contactEmail: 'retiro-test@example.com',
  },

  amounts: {
    amountWld: 12.75,
    amountCrcNet: null as number | null,
    exchangeRateCrcPerWld: null as number | null,
    commissionCrc: null as number | null,
  },

  idCapture: {
    frontSubmitted: true,
    backSubmitted: true,
  },

  chain: {
    transactionId:
      'wld_txn_9f2c4a8e1d0b7f63a5e842c1d0b9a7f4e2c8d6b0a4e1f3c5d7b9a0e2f4c6d8',
    txHash:
      '0xacfbf8e29c63c5d2f9e2b47d1a0e3c5b7d9f1a2b3c4d5e6f708192a3b4c5d6e7',
  },
} as const;

export function resolveAmountsFromMock(wld: number) {
  const m = WITHDRAWAL_TEST_MOCK.amounts;
  if (
    m.amountCrcNet != null &&
    m.exchangeRateCrcPerWld != null &&
    m.commissionCrc != null
  ) {
    return {
      amountCrc: m.amountCrcNet,
      exchangeRate: m.exchangeRateCrcPerWld,
      commissionCrc: m.commissionCrc,
    };
  }
  const c = calculateConversion(wld);
  return {
    amountCrc: c.netCrc,
    exchangeRate: EXCHANGE_RATES.WLD_TO_CRC,
    commissionCrc: c.fee,
  };
}

export function pickReferenceIdFromMock(): string {
  if (WITHDRAWAL_TEST_MOCK.useAutoReferenceId) {
    return `test_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 10)}`;
  }
  return WITHDRAWAL_TEST_MOCK.referenceId;
}

export function prismaWithdrawalUncheckedCreateData(
  referenceId: string
): Prisma.WithdrawalUncheckedCreateInput {
  const wld = WITHDRAWAL_TEST_MOCK.amounts.amountWld;
  const { amountCrc, exchangeRate, commissionCrc } = resolveAmountsFromMock(wld);
  const idSubmittedAt =
    WITHDRAWAL_TEST_MOCK.idCapture.frontSubmitted &&
    WITHDRAWAL_TEST_MOCK.idCapture.backSubmitted
      ? new Date()
      : null;

  return {
    referenceId,
    walletAddress: WITHDRAWAL_TEST_MOCK.walletAddress,
    firstName: WITHDRAWAL_TEST_MOCK.identity.firstName,
    lastName: WITHDRAWAL_TEST_MOCK.identity.lastName,
    idNumber: WITHDRAWAL_TEST_MOCK.identity.idNumber,
    phoneNumber: WITHDRAWAL_TEST_MOCK.identity.phoneNumber,
    accountNumber: WITHDRAWAL_TEST_MOCK.identity.accountNumber,
    contactEmail: WITHDRAWAL_TEST_MOCK.identity.contactEmail,
    amountWld: new Prisma.Decimal(wld),
    amountCrc: new Prisma.Decimal(amountCrc),
    exchangeRate: new Prisma.Decimal(exchangeRate),
    commissionCrc: new Prisma.Decimal(commissionCrc),
    idFrontSubmitted: WITHDRAWAL_TEST_MOCK.idCapture.frontSubmitted,
    idBackSubmitted: WITHDRAWAL_TEST_MOCK.idCapture.backSubmitted,
    idSubmittedAt,
    status: 'PENDING_PAYMENT',
  };
}

/**
 * Plain-text email payload (same numbers as DB mock) for Resend tests.
 * @param referenceId — use a unique value per send if you want to avoid Resend idempotency collapsing retries.
 */
export function buildComplianceEmailInputFromMock(
  referenceId: string
): WithdrawalComplianceEmailInput {
  const wld = WITHDRAWAL_TEST_MOCK.amounts.amountWld;
  const { amountCrc, exchangeRate, commissionCrc } = resolveAmountsFromMock(wld);
  const id = WITHDRAWAL_TEST_MOCK.identity;

  return {
    referenceId,
    walletAddress: WITHDRAWAL_TEST_MOCK.walletAddress,
    phoneNumber: id.phoneNumber,
    accountNumber: id.accountNumber,
    contactEmail: id.contactEmail,
    firstName: id.firstName,
    lastName: id.lastName,
    idNumber: id.idNumber,
    amountWld: String(wld),
    amountCrcEstimated: String(amountCrc),
    exchangeRateCrcPerWld: String(exchangeRate),
    commissionCrc: String(commissionCrc),
    transactionId: WITHDRAWAL_TEST_MOCK.chain.transactionId,
    txHash: WITHDRAWAL_TEST_MOCK.chain.txHash,
  };
}
