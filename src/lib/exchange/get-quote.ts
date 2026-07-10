import { unstable_cache } from 'next/cache';

import {
  getEnvExchangeQuote,
  quoteFromWorldLegs,
} from '@/constants/exchange';
import { fetchWldUsdCrcFromWorld } from '@/lib/exchange/world-wld-prices';
import type { ExchangeQuote } from '@/lib/exchange/types';

async function computeExchangeQuote(): Promise<ExchangeQuote> {
  const world = await fetchWldUsdCrcFromWorld();
  if (world) {
    return quoteFromWorldLegs(world.wldToUsd, world.wldToCrc);
  }
  return getEnvExchangeQuote();
}

const getCachedExchangeQuote = unstable_cache(computeExchangeQuote, ['exchange-quote-v1'], {
  revalidate: 60,
});

/**
 * One cached resolution path for the whole app (RSC, Route Handlers, etc.).
 * Revalidate window keeps World API traffic low while staying fresh enough for UI.
 */
export function getExchangeQuote(): Promise<ExchangeQuote> {
  return getCachedExchangeQuote();
}
