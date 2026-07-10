/**
 * Resolve on-chain tx hash from a World MiniKit transaction_id (no database).
 *
 * Usage (repo root; needs NEXT_PUBLIC_APP_ID in .env.local):
 *
 *   pnpm lookup:tx-hash -- <transaction_id>
 *   pnpm lookup:tx-hash -- --transaction-id <transaction_id>
 *
 * Optional:
 *   --reference <ref>     fail if World’s payment reference does not match
 *   --no-verify-receipt   skip chain receipt check on the returned hash
 *
 * Example:
 *   pnpm lookup:tx-hash -- 0x78a6fd4dccad381f48b8001ab0a8161f7a6c88bf4016009790f58cc0df46a5ec
 */

import {
  ResolveMinikitTxHashError,
  resolveTxHashFromMinikitPayment,
} from '../src/lib/resolve-minikit-tx-hash';

const WORLDCAN_TX = 'https://worldscan.org/tx/';

type Cli = {
  transactionId?: string;
  reference?: string;
  verifyReceipt: boolean;
};

function parseCli(): Cli {
  const argv = process.argv.slice(2).filter((a) => a !== '--');
  const out: Cli = { verifyReceipt: true };

  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];

    if (a === '--transaction-id' && next) {
      out.transactionId = next;
      i++;
      continue;
    }
    if (a.startsWith('--transaction-id=')) {
      out.transactionId = a.slice('--transaction-id='.length);
      continue;
    }
    if (a === '--reference' && next) {
      out.reference = next;
      i++;
      continue;
    }
    if (a.startsWith('--reference=')) {
      out.reference = a.slice('--reference='.length);
      continue;
    }
    if (a === '--no-verify-receipt') {
      out.verifyReceipt = false;
      continue;
    }
    if (a.startsWith('-')) {
      console.error(`Unknown flag: ${a}`);
      process.exit(1);
    }
    if (!out.transactionId) {
      out.transactionId = a;
      continue;
    }
    console.error(`Unexpected argument: ${a}`);
    process.exit(1);
  }

  return out;
}

function printUsage() {
  console.error(`Usage:
  pnpm lookup:tx-hash -- <transaction_id>
  pnpm lookup:tx-hash -- --transaction-id <transaction_id> [--reference <ref>]`);
}

async function main() {
  const cli = parseCli();
  const transactionId = cli.transactionId?.trim();
  if (!transactionId) {
    printUsage();
    process.exit(1);
  }

  const appId = process.env.NEXT_PUBLIC_APP_ID?.trim();
  if (!appId) {
    console.error('Missing NEXT_PUBLIC_APP_ID in .env.local');
    process.exit(1);
  }

  const expectedReference = cli.reference?.trim() || undefined;

  console.log('transaction_id:', transactionId);
  console.log('app_id:', appId);
  if (expectedReference) {
    console.log('expected reference:', expectedReference);
  }

  try {
    const resolved = await resolveTxHashFromMinikitPayment({
      transactionId,
      appId,
      expectedReference,
      verifyReceipt: cli.verifyReceipt,
    });

    console.log('\n--- Result ---');
    console.log('status:', resolved.transactionStatus);
    console.log('reference:', resolved.reference);
    console.log('transaction_hash:', resolved.transactionHash);
    console.log('explorer:', `${WORLDCAN_TX}${resolved.transactionHash}`);
  } catch (e) {
    if (e instanceof ResolveMinikitTxHashError) {
      console.error(`\nFailed (${e.code}): ${e.message}`);
      process.exit(1);
    }
    throw e;
  }
}

main().catch((e) => {
  console.error(e instanceof Error ? e.message : e);
  process.exit(1);
});
