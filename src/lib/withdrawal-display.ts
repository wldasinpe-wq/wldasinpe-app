import type { WithdrawalStatus } from '@prisma/client';

/**
 * User-facing phase for profile / history — clearer than raw DB status alone.
 */
export type WithdrawalDisplayPhase =
  | 'awaiting_payment'
  | 'confirming_chain'
  | 'transfer_ok_email_processing'
  | 'transfer_ok_email_failed'
  | 'transfer_failed_chain'
  | 'completed'
  | 'withdrawal_marked_failed';

export function withdrawalDisplayPhase(args: {
  status: WithdrawalStatus;
  txHash: string | null | undefined;
  lastError: string | null | undefined;
}): WithdrawalDisplayPhase {
  const { status, txHash, lastError } = args;
  const hash = txHash?.trim() ?? '';
  const err = lastError?.trim() ?? '';

  if (status === 'PENDING_PAYMENT') return 'awaiting_payment';
  if (status === 'EMAILED') return 'completed';
  if (status === 'FAILED') return 'withdrawal_marked_failed';
  if (status !== 'SUBMITTED') return 'awaiting_payment';

  if (!hash) return 'confirming_chain';
  if (err === 'on_chain_transaction_failed') return 'transfer_failed_chain';
  if (err.length > 0) return 'transfer_ok_email_failed';
  return 'transfer_ok_email_processing';
}
