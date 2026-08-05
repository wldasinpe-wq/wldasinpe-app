/**
 * DATABASE ONLY — inserts/updates `withdrawals` rows. Does NOT send email.
 * To send the compliance email with the same mock data: `pnpm test:email-compliance`
 *
 * Usage (from repo root, requires DATABASE_URL in .env.local):
 *   pnpm test:db-withdrawal              # default: full (create + finalize)
 *   pnpm test:db-withdrawal -- create    # insert PENDING_PAYMENT only
 *   pnpm test:db-withdrawal -- complete  # SUBMITTED for fixed referenceId (see fixture)
 *   pnpm test:db-withdrawal -- delete    # remove row by fixed referenceId
 *
 * Edit mock data in scripts/lib/withdrawal-test-fixture.ts
 */

import { PrismaClient } from '@prisma/client';

import {
  pickReferenceIdFromMock,
  prismaWithdrawalUncheckedCreateData,
  WITHDRAWAL_TEST_MOCK,
} from './lib/withdrawal-test-fixture';

const prisma = new PrismaClient();
const MOCK = WITHDRAWAL_TEST_MOCK;

async function cmdCreate(referenceId: string) {
  const row = await prisma.withdrawal.create({
    data: prismaWithdrawalUncheckedCreateData(referenceId),
  });

  console.log('[create] inserted:', row.referenceId, row.id);
  return row;
}

async function cmdComplete(referenceId: string) {
  const updated = await prisma.withdrawal.update({
    where: { referenceId },
    data: {
      transactionId: MOCK.chain.transactionId,
      txHash: MOCK.chain.txHash,
      status: 'SUBMITTED',
      lastError: null,
    },
  });
  console.log('[complete] updated:', updated.referenceId, updated.status);
  return updated;
}

async function cmdDelete(referenceId: string) {
  await prisma.withdrawal.delete({ where: { referenceId } });
  console.log('[delete] removed:', referenceId);
}

const COMMANDS = new Set(['create', 'complete', 'delete', 'full']);

function parseCommand(): string {
  const positional = process.argv.slice(2).filter((a) => !a.startsWith('-'));
  const named = positional.find((a) => COMMANDS.has(a));
  return named ?? 'full';
}

async function main() {
  const command = parseCommand();

  if (!process.env.DATABASE_URL) {
    console.error('Missing DATABASE_URL. Add it to .env.local and retry.');
    process.exit(1);
  }

  const refForFixed = MOCK.referenceId;

  try {
    switch (command) {
      case 'create': {
        const ref = pickReferenceIdFromMock();
        await cmdCreate(ref);
        if (MOCK.useAutoReferenceId) {
          console.log('\nUse this referenceId for `complete` / `delete`:', ref);
        }
        break;
      }
      case 'complete': {
        await cmdComplete(refForFixed);
        break;
      }
      case 'delete': {
        await cmdDelete(refForFixed);
        break;
      }
      case 'full': {
        const ref = pickReferenceIdFromMock();
        await cmdCreate(ref);
        await cmdComplete(ref);
        const row = await prisma.withdrawal.findUniqueOrThrow({
          where: { referenceId: ref },
        });
        console.log('\n[full] final row (JSON-ish):');
        console.log(
          JSON.stringify(
            {
              ...row,
              amountWld: row.amountWld.toString(),
              amountCrc: row.amountCrc.toString(),
              exchangeRate: row.exchangeRate.toString(),
              commissionCrc: row.commissionCrc.toString(),
              createdAt: row.createdAt.toISOString(),
              updatedAt: row.updatedAt.toISOString(),
            },
            null,
            2
          )
        );
        console.log(
          '\nTo remove this test row: set useAutoReferenceId = false,',
          'referenceId =',
          JSON.stringify(ref),
          'in scripts/lib/withdrawal-test-fixture.ts',
          'then pnpm test:db-withdrawal -- delete'
        );
        break;
      }
      default:
        console.error('Unknown command:', command);
        console.error('Use: create | complete | delete | full');
        process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

void main();
