export type ExchangeQuoteSource = 'world' | 'env';

/** Single FX snapshot used across UI and withdrawal persistence. */
export type ExchangeQuote = {
  wldToCrc: number;
  wldToUsd: number;
  usdToCrc: number;
  source: ExchangeQuoteSource;
  fetchedAt: string;
};

export type ConversionBreakdown = {
  wld: number;
  usd: number;
  crc: number;
  fee: number;
  netCrc: number;
};

/** UI-only estimate (Ridivi: swap % + flat USD). Not used for settlement. */
export type DisplayConversionBreakdown = ConversionBreakdown & {
  swapFeeCrc: number;
  flatFeeCrc: number;
};
