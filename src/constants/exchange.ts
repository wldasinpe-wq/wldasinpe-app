/**
 * FX + Ridivi fee estimates for UI.
 *
 * - Live WLD→CRC (and WLD→USD) via World Get Prices — see `getExchangeQuote()` in `@/lib/exchange/get-quote`.
 * - Env fallback: `NEXT_PUBLIC_WLD_TO_CRC` or `NEXT_PUBLIC_WLD_TO_USD` + `NEXT_PUBLIC_USD_TO_CRC`.
 * - Fee estimate: `NEXT_PUBLIC_RIDIVI_SWAP_FEE_BPS` + `NEXT_PUBLIC_RIDIVI_FLAT_FEE_USD` — see `estimateDisplayConversion()`.
 *
 * Client-visible env vars must stay `NEXT_PUBLIC_*` with static `process.env` access for bundling.
 */

import type {
  DisplayConversionBreakdown,
  ExchangeQuote,
} from '@/lib/exchange/types';

function parsePositiveFloat(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function parseNonNegativeFloat(raw: string | undefined): number | null {
  if (raw === undefined || raw === '') return null;
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

// Static env access only (required for Next.js client bundle where used).
const envWldToCrc = parsePositiveFloat(process.env.NEXT_PUBLIC_WLD_TO_CRC);
const envWldToUsd = parsePositiveFloat(process.env.NEXT_PUBLIC_WLD_TO_USD);
const envUsdToCrc = parsePositiveFloat(process.env.NEXT_PUBLIC_USD_TO_CRC);
const envRidiviSwapFeeBps = parseNonNegativeFloat(
  process.env.NEXT_PUBLIC_RIDIVI_SWAP_FEE_BPS,
);
const envRidiviDisplayFlatFeeUsd = parsePositiveFloat(
  process.env.NEXT_PUBLIC_RIDIVI_FLAT_FEE_USD,
);

/** Ridivi fee policy for UI estimates only (defaults: 2% swap + USD 3). */
export const RIDIVI_DISPLAY_FEES = {
  swapFeeBps: envRidiviSwapFeeBps ?? 200,
  flatFeeUsd: envRidiviDisplayFlatFeeUsd ?? 3,
} as const;

export function formatSwapFeePercent(bps: number): string {
  const pct = bps / 100;
  return Number.isInteger(pct) ? `${pct}%` : `${pct.toFixed(2)}%`;
}

function resolveEnvWldToCrc(): number {
  if (envWldToCrc != null) return envWldToCrc;
  if (envWldToUsd != null && envUsdToCrc != null) {
    return envWldToUsd * envUsdToCrc;
  }
  return 0;
}

function resolveEnvWldToUsd(): number {
  if (envWldToUsd != null) return envWldToUsd;
  if (envWldToCrc != null && envUsdToCrc != null && envUsdToCrc > 0) {
    return envWldToCrc / envUsdToCrc;
  }
  return 0;
}

function resolveEnvUsdToCrc(): number {
  if (envUsdToCrc != null) return envUsdToCrc;
  if (envWldToCrc != null && envWldToUsd != null && envWldToUsd > 0) {
    return envWldToCrc / envWldToUsd;
  }
  return 0;
}

function isoNow(): string {
  return new Date().toISOString();
}

/** Quote built only from env (fallback / scripts / tests). */
export function getEnvExchangeQuote(): ExchangeQuote {
  const wldToCrc = resolveEnvWldToCrc();
  const wldToUsd = resolveEnvWldToUsd();
  const usdToCrc = resolveEnvUsdToCrc();
  return {
    wldToCrc,
    wldToUsd,
    usdToCrc,
    source: 'env',
    fetchedAt: isoNow(),
  };
}

/** Merge World WLD legs into a quote snapshot. */
export function quoteFromWorldLegs(
  wldToUsd: number,
  wldToCrc: number
): ExchangeQuote {
  const usdToCrc = wldToCrc / wldToUsd;
  return {
    wldToUsd,
    wldToCrc,
    usdToCrc,
    source: 'world',
    fetchedAt: isoNow(),
  };
}

export const LIMITS = {
  MIN_WLD: 0.1,
  MIN_USD: 0.1,
} as const;

export const formatCurrency = {
  WLD: (amount: number) => `${amount.toFixed(2)} WLD`,
  USD: (amount: number) => `$${amount.toFixed(2)}`,
  CRC: (amount: number) => `\u20a1${amount.toFixed(0)}`,
};

/**
 * Approximate Ridivi fees for UI and stored net-CRC estimates — 2% on WLD→USD + flat USD fee.
 * Ridivi settles the final amount; this is not a payout calculation.
 */
export function estimateDisplayConversion(
  quote: ExchangeQuote,
  wldAmount: number,
): DisplayConversionBreakdown {
  const grossUsd = wldAmount * quote.wldToUsd;
  const grossCrc = wldAmount * quote.wldToCrc;
  const usdToCrc = quote.usdToCrc > 0 ? quote.usdToCrc : 0;
  const swapFeeUsd =
    grossUsd * (RIDIVI_DISPLAY_FEES.swapFeeBps / 10_000);
  const swapFeeCrc = swapFeeUsd * usdToCrc;
  const flatFeeCrc = RIDIVI_DISPLAY_FEES.flatFeeUsd * usdToCrc;
  const fee = swapFeeCrc + flatFeeCrc;
  const netCrc = Math.max(0, grossCrc - fee);

  return {
    wld: wldAmount,
    usd: grossUsd,
    crc: grossCrc,
    swapFeeCrc,
    flatFeeCrc,
    fee,
    netCrc,
  };
}
