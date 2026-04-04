/**
 * Pricing: defaults match legacy hard-coded values. Override via env for manual
 * ops until a live pricing endpoint exists (set in `.env` / hosting backdoor).
 *
 * - NEXT_PUBLIC_WLD_TO_CRC — CRC received per 1 WLD (tasa efectiva WLD→CRC).
 * - NEXT_PUBLIC_COMISION_CRC — comisión fija por transacción en colones.
 */

function readOptionalPositiveFloat(envName: string): number | null {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n <= 0) return null;
  return n;
}

function readOptionalNonNegativeFloat(envName: string): number | null {
  const raw = process.env[envName];
  if (raw === undefined || raw === '') return null;
  const n = Number(raw);
  if (!Number.isFinite(n) || n < 0) return null;
  return n;
}

const envWldToCrc = readOptionalPositiveFloat('NEXT_PUBLIC_WLD_TO_CRC');
const envComisionCrc = readOptionalNonNegativeFloat('NEXT_PUBLIC_COMISION_CRC');

// Exchange rates - TODO: Replace with real-time API
export const EXCHANGE_RATES = {
  WLD_TO_USD: 0.4,
  USD_TO_CRC: 495,
  get WLD_TO_CRC() {
    if (envWldToCrc != null) return envWldToCrc;
    return this.WLD_TO_USD * this.USD_TO_CRC;
  },
} as const;

// Fees - TODO: Replace with actual fee structure from Ridivi / API
export const FEES = {
  FLAT_FEE_USD: 1.0,
  get FLAT_FEE_CRC() {
    if (envComisionCrc != null) return envComisionCrc;
    return this.FLAT_FEE_USD * EXCHANGE_RATES.USD_TO_CRC;
  },
} as const;

// Minimum withdrawal amounts
export const LIMITS = {
  MIN_WLD: 0.1,
  MIN_USD: 0.1,
} as const;

// Format currency helpers
export const formatCurrency = {
  WLD: (amount: number) => `${amount.toFixed(2)} WLD`,
  USD: (amount: number) => `$${amount.toFixed(2)}`,
  CRC: (amount: number) => `₡${amount.toFixed(0)}`,
};

// Calculate conversions
export const calculateConversion = (wldAmount: number) => {
  const usdAmount = wldAmount * EXCHANGE_RATES.WLD_TO_USD;
  const crcAmount = wldAmount * EXCHANGE_RATES.WLD_TO_CRC;
  const netCrc = crcAmount - FEES.FLAT_FEE_CRC;

  return {
    wld: wldAmount,
    usd: usdAmount,
    crc: crcAmount,
    fee: FEES.FLAT_FEE_CRC,
    netCrc: Math.max(0, netCrc),
  };
};
