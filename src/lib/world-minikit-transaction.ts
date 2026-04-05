/**
 * World Developer Portal — MiniKit transaction status (payment command).
 * @see https://docs.world.org/api-reference/developer-portal/get-transaction
 */

export const TRANSACTION_PENDING_ERROR = 'transaction_pending' as const;

type MinikitPaymentTransactionStatus = {
  reference: string;
  transaction_hash: string | null;
  transaction_status: 'pending' | 'mined' | 'failed';
  from?: string;
  to?: string;
  chain?: string;
  token?: string;
  token_amount?: string;
  timestamp?: string;
  app_id?: string;
};

const DEFAULT_BASE = 'https://developer.world.org';

export async function fetchMinikitPaymentTransaction(
  transactionId: string,
  appId: string
): Promise<MinikitPaymentTransactionStatus | null> {
  const base =
    process.env.WORLD_DEVELOPER_API_BASE_URL?.trim() || DEFAULT_BASE;
  const url = new URL(
    `${base.replace(/\/$/, '')}/api/v2/minikit/transaction/${encodeURIComponent(transactionId)}`
  );
  url.searchParams.set('app_id', appId);
  url.searchParams.set('type', 'payment');

  const res = await fetch(url.toString(), { cache: 'no-store' });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`World developer API HTTP ${res.status}`);
  }
  return (await res.json()) as MinikitPaymentTransactionStatus;
}
