/**
 * Backfill `withdrawals.tx_hash` only — does NOT send email or change status.
 *
 * Usage (repo root, needs DATABASE_URL + NEXT_PUBLIC_APP_ID in .env.local):
 *
 *   pnpm backfill:tx-hash -- --reference <referenceId>
 *   pnpm backfill:tx-hash -- --withdrawal-id <prisma_cuid>
 *
 * Resolve hash from World Get Transaction + receipt check (same idea as complete-withdrawal):
 *   requires `transaction_id` on the row.
 *
 * Set hash manually from Worldscan (still verifies success receipt unless --no-verify):
 *   pnpm backfill:tx-hash -- --reference <ref> --hash 0x...
 *
 * Optional:
 *   --clear-last-error   also set last_error to null
 *   --no-verify          with --hash only: skip getTransactionReceipt check
 *
 * Examples:
 *   pnpm backfill:tx-hash -- --reference abc123...
 *   pnpm backfill:tx-hash -- --reference abc123... --hash 0x1d63...
 */

import { PrismaClient } from '@prisma/client';

import { getWorldchainTxOutcome } from '../src/lib/wld-onchain';
import { fetchMinikitPaymentTransaction } from '../src/lib/world-minikit-transaction';

const prisma = new PrismaClient();

type Cli = {
  reference?: string;
  withdrawalId?: string;
  hash?: string;
  noVerify: boolean;
  clearLastError: boolean;
};

function parseCli(): Cli {
  const argv = process.argv.slice(2);
  const out: Cli = { noVerify: false, clearLastError: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    const next = argv[i + 1];
    if (a === '--reference' && next) {
      out.reference = next;
      i++;
      continue;
    }
    if (a.startsWith('--reference=')) {
      out.reference = a.slice('--reference='.length);
      continue;
    }
    if (a === '--withdrawal-id' && next) {
      out.withdrawalId = next;
      i++;
      continue;
    }
    if (a.startsWith('--withdrawal-id=')) {
      out.withdrawalId = a.slice('--withdrawal-id='.length);
      continue;
    }
    if (a === '--hash' && next) {
      out.hash = next;
      i++;
      continue;
    }
    if (a.startsWith('--hash=')) {
      out.hash = a.slice('--hash='.length);
      continue;
    }
    if (a === '--no-verify') {
      out.noVerify = true;
      continue;
    }
    if (a === '--clear-last-error') {
      out.clearLastError = true;
      continue;
    }
  }
  return out;
}

async function resolveHash(args: {
  manualHash: string | undefined;
  noVerify: boolean;
  transactionId: string | null;
  appId: string;
}): Promise<string> {
  const manual = args.manualHash?.trim();
  if (manual) {
    if (!/^0x[a-fA-F0-9]{64}$/i.test(manual)) {
      throw new Error('Invalid --hash (expect 0x + 64 hex chars)');
    }
    if (args.noVerify) {
      return manual;
    }
    const o = await getWorldchainTxOutcome(manual);
    if (o !== 'success') {
      throw new Error(
        `Receipt check for --hash failed (${o}). Use --no-verify to force (not recommended).`,
      );
    }
    return manual;
  }

  const tid = args.transactionId?.trim();
  if (!tid) {
    throw new Error(
      'Row has no transaction_id. Pass --hash 0x... from Worldscan (receipt must succeed unless --no-verify).',
    );
  }

  const chainTx = await fetchMinikitPaymentTransaction(tid, args.appId);
  if (!chainTx) {
    throw new Error(
      'World Get Transaction returned 404 for this transaction_id.',
    );
  }

  const apiHash = chainTx.transaction_hash?.trim() ?? '';
  if (chainTx.transaction_status === 'mined' && apiHash) {
    return apiHash;
  }
  if (apiHash) {
    const o = await getWorldchainTxOutcome(apiHash);
    if (o === 'success') {
      return apiHash;
    }
    throw new Error(
      `World returned hash but receipt is "${o}". Wait or pass --hash from explorer.`,
    );
  }

  throw new Error(
    'No transaction_hash from World yet. Pass --hash 0x... from Worldscan.',
  );
}

async function main() {
  const cli = parseCli();

  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL (.env.local).');
    process.exit(1);
  }

  const appId = process.env.NEXT_PUBLIC_APP_ID?.trim();
  if (!cli.hash && !appId) {
    console.error(
      'Missing NEXT_PUBLIC_APP_ID (needed to call World Get Transaction). Or pass --hash.',
    );
    process.exit(1);
  }

  const hasRef = Boolean(cli.reference?.trim());
  const hasId = Boolean(cli.withdrawalId?.trim());
  if (hasRef === hasId) {
    console.error(
      'Provide exactly one of: --reference <referenceId> | --withdrawal-id <cuid>',
    );
    process.exit(1);
  }

  const row = hasRef
    ? await prisma.withdrawal.findUnique({
        where: { referenceId: cli.reference!.trim() },
      })
    : await prisma.withdrawal.findUnique({
        where: { id: cli.withdrawalId!.trim() },
      });

  if (!row) {
    console.error('Withdrawal not found.');
    process.exit(1);
  }

  console.log('Row:', row.id, 'referenceId:', row.referenceId);
  console.log('Current txHash:', row.txHash ?? '(null)');
  console.log('transactionId:', row.transactionId ?? '(null)');

  const hash = await resolveHash({
    manualHash: cli.hash,
    noVerify: cli.noVerify,
    transactionId: row.transactionId,
    appId: appId ?? '',
  });

  await prisma.withdrawal.update({
    where: { id: row.id },
    data: {
      txHash: hash,
      ...(cli.clearLastError ? { lastError: null } : {}),
    },
  });

  console.log('Updated tx_hash:', hash);
  if (cli.clearLastError) {
    console.log('Cleared last_error.');
  }
}

main()
  .catch((e) => {
    console.error(e instanceof Error ? e.message : e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
