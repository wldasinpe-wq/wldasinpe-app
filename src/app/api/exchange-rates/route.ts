import { NextResponse } from 'next/server';

import { getExchangeQuote } from '@/lib/exchange/get-quote';

/**
 * Single JSON snapshot for client UI (protected flows use the same cached `getExchangeQuote` as RSC/API).
 */
export async function GET() {
  try {
    const quote = await getExchangeQuote();
    return NextResponse.json(quote, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=120',
      },
    });
  } catch (e) {
    console.error('[exchange-rates]', e);
    return NextResponse.json(
      { error: 'exchange_rates_unavailable' },
      { status: 502 }
    );
  }
}
