/**
 * CLI: consulta pública World Get Prices (WLD → USD, CRC).
 *
 *   pnpm query:wld-prices
 *   pnpm exec tsx scripts/query-world-wld-prices.ts
 *
 * Usa `WORLD_MINIAPPS_PRICES_BASE_URL` si está definido (mismo que la app).
 */

import { fetchWldUsdCrcFromWorld } from '../src/lib/exchange/world-wld-prices';

function main() {
  void (async () => {
    const base =
      process.env.WORLD_MINIAPPS_PRICES_BASE_URL?.trim() ||
      'https://app-backend.worldcoin.dev';
    console.log(`Base: ${base}`);
    console.log('');

    const legs = await fetchWldUsdCrcFromWorld();
    if (!legs) {
      console.error('No se pudo obtener precios (respuesta inválida o error de red).');
      process.exit(1);
    }

    const { wldToUsd, wldToCrc } = legs;
    const crcPerUsd = wldToCrc / wldToUsd;

    console.log('1 WLD =', wldToUsd.toFixed(6), 'USD');
    console.log('1 WLD =', wldToCrc.toFixed(4), 'CRC (decimal)');
    console.log('1 WLD =', Math.round(wldToCrc).toLocaleString('es-CR'), 'CRC (redondeo UI, toFixed(0))');
    console.log('');
    console.log('Implícito desde el mismo feed:');
    console.log('  1 USD ~', crcPerUsd.toFixed(4), 'CRC');
    console.log('  (check: WLD→CRC / WLD→USD)');
    console.log('');
    console.log('JSON:', JSON.stringify({ wldToUsd, wldToCrc, crcPerUsd }));
  })().catch((e) => {
    console.error(e);
    process.exit(1);
  });
}

main();
