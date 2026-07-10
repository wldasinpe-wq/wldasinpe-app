/**
 * World Developer Portal — MiniKit transaction status (payment command).
 * @see https://docs.world.org/api-reference/developer-portal/get-transaction
 */

export const TRANSACTION_PENDING_ERROR = 'transaction_pending' as const;

/** World API: payment not yet `mined` or `transaction_hash` not populated — retry like pending. */
export const TRANSACTION_NOT_READY_ERROR = 'transaction_not_ready' as const;

export type MinikitPaymentTransactionStatus = {
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

/** Maps portal JSON (snake/camel, legacy `status`) into a single shape. */
export function normalizeMinikitPaymentTransaction(
  raw: unknown,
): MinikitPaymentTransactionStatus {
  const o =
    raw && typeof raw === 'object' ? (raw as Record<string, unknown>) : {};
  const statusRaw = String(
    o.transaction_status ?? o.status ?? o.transactionStatus ?? '',
  ).toLowerCase();
  let transaction_status: MinikitPaymentTransactionStatus['transaction_status'] =
    'pending';
  if (statusRaw === 'mined' || statusRaw === 'success' || statusRaw === 'confirmed') {
    transaction_status = 'mined';
  } else if (statusRaw === 'failed') {
    transaction_status = 'failed';
  }

  const th = o.transaction_hash ?? o.transactionHash;
  const transaction_hash =
    typeof th === 'string' && th.trim() ? th.trim() : null;

  return {
    reference: typeof o.reference === 'string' ? o.reference : String(o.reference ?? ''),
    transaction_hash,
    transaction_status,
    from: typeof o.from === 'string' ? o.from : undefined,
    to: typeof o.to === 'string' ? o.to : undefined,
    chain: typeof o.chain === 'string' ? o.chain : undefined,
    token: typeof o.token === 'string' ? o.token : undefined,
    token_amount:
      typeof o.token_amount === 'string'
        ? o.token_amount
        : typeof o.tokenAmount === 'string'
          ? o.tokenAmount
          : undefined,
    timestamp: typeof o.timestamp === 'string' ? o.timestamp : undefined,
    app_id:
      typeof o.app_id === 'string'
        ? o.app_id
        : typeof o.appId === 'string'
          ? o.appId
          : undefined,
  };
}

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

  const headers: HeadersInit = {};
  // OpenAPI lists no auth for this route; app_id query is enough. Bearer optional if you add a key later.
  const apiKey = process.env.WORLD_DEVELOPER_API_KEY?.trim();
  if (apiKey) {
    (headers as Record<string, string>)['Authorization'] = `Bearer ${apiKey}`;
  }

  const res = await fetch(url.toString(), { cache: 'no-store', headers });
  if (res.status === 404) {
    return null;
  }
  if (!res.ok) {
    throw new Error(`World developer API HTTP ${res.status}`);
  }
  return normalizeMinikitPaymentTransaction(await res.json());
}
