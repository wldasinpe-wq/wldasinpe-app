/**
 * FX + fee resolution.
 *
 * - Live WLD→CRC (and WLD→USD) via World Get Prices — see `getExchangeQuote()` in `@/lib/exchange/get-quote`.
 * - Env fallback: `NEXT_PUBLIC_WLD_TO_CRC` or `NEXT_PUBLIC_WLD_TO_USD` + `NEXT_PUBLIC_USD_TO_CRC`.
 * - Fee: `NEXT_PUBLIC_COMISION_CRC` or `NEXT_PUBLIC_FLAT_FEE_USD` × USD→CRC (CRC from quote legs).
 *
 * Client-visible fee env vars must stay `NEXT_PUBLIC_*` with static `process.env` access for bundling.
 */

import type {
  ConversionBreakdown,
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
const envComisionCrc = parseNonNegativeFloat(process.env.NEXT_PUBLIC_COMISION_CRC);
const envFlatFeeUsd = parsePositiveFloat(process.env.NEXT_PUBLIC_FLAT_FEE_USD);

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

/** Fixed fee in CRC from env, using USD→CRC when fee is configured in USD. */
export function resolveFlatFeeCrcFromEnv(usdToCrc: number): number {
  if (envComisionCrc != null) return envComisionCrc;
  if (envFlatFeeUsd != null && usdToCrc > 0) {
    return envFlatFeeUsd * usdToCrc;
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
  const flatFeeCrc = resolveFlatFeeCrcFromEnv(usdToCrc);
  return {
    wldToCrc,
    wldToUsd,
    usdToCrc,
    flatFeeCrc,
    source: 'env',
    fetchedAt: isoNow(),
  };
}

/** Merge World WLD legs with fee rules from env. */
export function quoteFromWorldLegs(
  wldToUsd: number,
  wldToCrc: number
): ExchangeQuote {
  const usdToCrc = wldToCrc / wldToUsd;
  return {
    wldToUsd,
    wldToCrc,
    usdToCrc,
    flatFeeCrc: resolveFlatFeeCrcFromEnv(usdToCrc),
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

export function calculateConversionFromQuote(
  quote: ExchangeQuote,
  wldAmount: number
): ConversionBreakdown {
  const wldToUsd = quote.wldToUsd;
  const wldToCrc = quote.wldToCrc;
  const usdAmount = wldAmount * wldToUsd;
  const crcAmount = wldAmount * wldToCrc;
  const fee = quote.flatFeeCrc;
  const netCrc = crcAmount - fee;

  return {
    wld: wldAmount,
    usd: usdAmount,
    crc: crcAmount,
    fee,
    netCrc: Math.max(0, netCrc),
  };
}
