/**
 * World public Mini Apps prices API — WLD in fiat (incl. CRC).
 * @see https://docs.world.org/api-reference/get-prices
 */

const DEFAULT_BASE = 'https://app-backend.worldcoin.dev';

type PriceEntry = {
  amount?: string;
  decimals?: number;
};

function parsePrice(entry: PriceEntry | undefined): number | null {
  if (!entry || typeof entry.amount !== 'string') return null;
  const decimals =
    typeof entry.decimals === 'number' && Number.isFinite(entry.decimals)
      ? entry.decimals
      : 0;
  let raw: bigint;
  try {
    raw = BigInt(entry.amount);
  } catch {
    return null;
  }
  const divisor = 10 ** decimals;
  if (!Number.isFinite(divisor) || divisor <= 0) return null;
  return Number(raw) / divisor;
}

export type WldFiatLegs = { wldToUsd: number; wldToCrc: number };

/**
 * Fetches WLD→USD and WLD→CRC in one HTTP request.
 * Returns null if the response is missing or invalid.
 */
export async function fetchWldUsdCrcFromWorld(): Promise<WldFiatLegs | null> {
  const base =
    process.env.WORLD_MINIAPPS_PRICES_BASE_URL?.trim() || DEFAULT_BASE;
  const url = new URL(
    `${base.replace(/\/$/, '')}/public/v1/miniapps/prices`
  );
  url.searchParams.set('cryptoCurrencies', 'WLD');
  url.searchParams.set('fiatCurrencies', 'USD,CRC');

  let res: Response;
  try {
    res = await fetch(url.toString(), { cache: 'no-store' });
  } catch {
    return null;
  }

  if (!res.ok) {
    return null;
  }

  let body: unknown;
  try {
    body = await res.json();
  } catch {
    return null;
  }

  const root =
    body && typeof body === 'object' && 'result' in body
      ? (body as { result?: unknown }).result
      : null;
  const prices =
    root &&
    typeof root === 'object' &&
    'prices' in root &&
    (root as { prices?: unknown }).prices &&
    typeof (root as { prices: unknown }).prices === 'object'
      ? (root as { prices: Record<string, unknown> }).prices
      : null;

  if (!prices || typeof prices.WLD !== 'object' || !prices.WLD) {
    return null;
  }

  const wld = prices.WLD as Record<string, PriceEntry>;
  const wldToUsd = parsePrice(wld.USD);
  const wldToCrc = parsePrice(wld.CRC);

  if (
    wldToUsd == null ||
    wldToCrc == null ||
    wldToUsd <= 0 ||
    wldToCrc <= 0
  ) {
    return null;
  }

  return { wldToUsd, wldToCrc };
}
