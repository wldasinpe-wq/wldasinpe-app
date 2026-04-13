export type ExchangeQuoteSource = 'world' | 'env';

/** Single snapshot of FX + fee used across UI and withdrawal persistence. */
export type ExchangeQuote = {
  wldToCrc: number;
  wldToUsd: number;
  usdToCrc: number;
  flatFeeCrc: number;
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
