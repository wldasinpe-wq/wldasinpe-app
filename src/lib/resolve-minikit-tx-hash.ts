import { getWorldchainTxOutcome } from '@/lib/wld-onchain';
import {
  fetchMinikitPaymentTransaction,
  type MinikitPaymentTransactionStatus,
} from '@/lib/world-minikit-transaction';

export type ResolvedMinikitTxHash = {
  reference: string;
  transactionId: string;
  transactionStatus: MinikitPaymentTransactionStatus['transaction_status'];
  transactionHash: string;
};

export class ResolveMinikitTxHashError extends Error {
  constructor(
    message: string,
    readonly code:
      | 'not_found'
      | 'reference_mismatch'
      | 'no_hash'
      | 'receipt_pending'
      | 'receipt_reverted'
  ) {
    super(message);
    this.name = 'ResolveMinikitTxHashError';
  }
}

/**
 * Resolves on-chain hash via World Get Transaction (+ optional receipt check).
 * @see https://docs.world.org/api-reference/developer-portal/get-transaction
 */
export async function resolveTxHashFromMinikitPayment(args: {
  transactionId: string;
  appId: string;
  expectedReference?: string;
  verifyReceipt?: boolean;
}): Promise<ResolvedMinikitTxHash> {
  const transactionId = args.transactionId.trim();
  const appId = args.appId.trim();
  if (!transactionId || !appId) {
    throw new Error('transactionId and appId are required');
  }

  const chainTx = await fetchMinikitPaymentTransaction(transactionId, appId);
  if (!chainTx) {
    throw new ResolveMinikitTxHashError(
      'World Get Transaction returned 404 for this transaction_id.',
      'not_found'
    );
  }

  if (
    args.expectedReference?.trim() &&
    chainTx.reference !== args.expectedReference.trim()
  ) {
    throw new ResolveMinikitTxHashError(
      `Reference mismatch: World has "${chainTx.reference}", expected "${args.expectedReference.trim()}".`,
      'reference_mismatch'
    );
  }

  const apiHash = chainTx.transaction_hash?.trim() ?? '';
  if (!apiHash) {
    throw new ResolveMinikitTxHashError(
      `Payment status is "${chainTx.transaction_status}" but transaction_hash is still empty.`,
      'no_hash'
    );
  }

  if (args.verifyReceipt !== false) {
    const outcome = await getWorldchainTxOutcome(apiHash);
    if (outcome === 'pending') {
      throw new ResolveMinikitTxHashError(
        `World returned hash ${apiHash} but chain receipt is still pending.`,
        'receipt_pending'
      );
    }
    if (outcome === 'reverted') {
      throw new ResolveMinikitTxHashError(
        `Chain receipt for ${apiHash} is reverted.`,
        'receipt_reverted'
      );
    }
    if (outcome === 'invalid') {
      throw new ResolveMinikitTxHashError(
        `Invalid hash from World: ${apiHash}`,
        'no_hash'
      );
    }
  }

  return {
    reference: chainTx.reference,
    transactionId,
    transactionStatus: chainTx.transaction_status,
    transactionHash: apiHash,
  };
}
