/**
 * Pricing from `NEXT_PUBLIC_*` env vars. Must use **static** `process.env.NEXT_PUBLIC_*`
 * references so Next.js can inline them in the client bundle (dynamic `process.env[name]` does not work).
 *
 * - `NEXT_PUBLIC_WLD_TO_CRC` — CRC per 1 WLD, or omit and set WLD_TO_USD + USD_TO_CRC.
 * - `NEXT_PUBLIC_COMISION_CRC` — fixed fee per withdrawal in CRC, or FLAT_FEE_USD × USD_TO_CRC.
 */

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

// Static env access only (required for Next.js client bundle).
const envWldToCrc = parsePositiveFloat(process.env.NEXT_PUBLIC_WLD_TO_CRC);
const envWldToUsd = parsePositiveFloat(process.env.NEXT_PUBLIC_WLD_TO_USD);
const envUsdToCrc = parsePositiveFloat(process.env.NEXT_PUBLIC_USD_TO_CRC);
const envComisionCrc = parseNonNegativeFloat(process.env.NEXT_PUBLIC_COMISION_CRC);
const envFlatFeeUsd = parsePositiveFloat(process.env.NEXT_PUBLIC_FLAT_FEE_USD);

function resolveWldToCrc(): number {
  if (envWldToCrc != null) return envWldToCrc;
  if (envWldToUsd != null && envUsdToCrc != null) {
    return envWldToUsd * envUsdToCrc;
  }
  return 0;
}

function resolveWldToUsd(): number {
  if (envWldToUsd != null) return envWldToUsd;
  if (envWldToCrc != null && envUsdToCrc != null && envUsdToCrc > 0) {
    return envWldToCrc / envUsdToCrc;
  }
  return 0;
}

function resolveUsdToCrc(): number {
  if (envUsdToCrc != null) return envUsdToCrc;
  if (envWldToCrc != null && envWldToUsd != null && envWldToUsd > 0) {
    return envWldToCrc / envWldToUsd;
  }
  return 0;
}

function resolveFlatFeeCrc(): number {
  if (envComisionCrc != null) return envComisionCrc;
  if (envFlatFeeUsd != null && envUsdToCrc != null) {
    return envFlatFeeUsd * envUsdToCrc;
  }
  return 0;
}

export const EXCHANGE_RATES = {
  get WLD_TO_USD() {
    return resolveWldToUsd();
  },
  get USD_TO_CRC() {
    return resolveUsdToCrc();
  },
  get WLD_TO_CRC() {
    return resolveWldToCrc();
  },
} as const;

export const FEES = {
  get FLAT_FEE_CRC() {
    return resolveFlatFeeCrc();
  },
} as const;

export const LIMITS = {
  MIN_WLD: 0.1,
  MIN_USD: 0.1,
} as const;

export const formatCurrency = {
  WLD: (amount: number) => `${amount.toFixed(2)} WLD`,
  USD: (amount: number) => `$${amount.toFixed(2)}`,
  CRC: (amount: number) => `₡${amount.toFixed(0)}`,
};

export const calculateConversion = (wldAmount: number) => {
  const wldToUsd = EXCHANGE_RATES.WLD_TO_USD;
  const wldToCrc = EXCHANGE_RATES.WLD_TO_CRC;
  const usdAmount = wldAmount * wldToUsd;
  const crcAmount = wldAmount * wldToCrc;
  const netCrc = crcAmount - FEES.FLAT_FEE_CRC;

  return {
    wld: wldAmount,
    usd: usdAmount,
    crc: crcAmount,
    fee: FEES.FLAT_FEE_CRC,
    netCrc: Math.max(0, netCrc),
  };
};
