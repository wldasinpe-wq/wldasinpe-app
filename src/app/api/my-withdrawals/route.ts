import { auth } from '@/auth';
import { prisma } from '@/lib/prisma';
import { withdrawalDisplayPhase } from '@/lib/withdrawal-display';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';

function walletFromSession(session: Session | null): string | null {
  const w = session?.user?.walletAddress;
  if (w && /^0x[a-fA-F0-9]{40}$/i.test(w)) {
    return w.toLowerCase();
  }
  const id = session?.user?.id;
  if (id && /^0x[a-fA-F0-9]{40}$/i.test(id)) {
    return id.toLowerCase();
  }
  return null;
}

/**
 * Lists withdrawals for the authenticated wallet (summary only — no ID / phone / email).
 */
export async function GET() {
  const session = await auth();
  const wallet = walletFromSession(session);
  if (!wallet) {
    return NextResponse.json({ error: 'no_wallet' }, { status: 401 });
  }

  const rows = await prisma.withdrawal.findMany({
    where: { walletAddress: { equals: wallet, mode: 'insensitive' } },
    orderBy: { createdAt: 'desc' },
    take: 50,
    select: {
      id: true,
      referenceId: true,
      status: true,
      amountWld: true,
      amountCrc: true,
      exchangeRate: true,
      commissionCrc: true,
      createdAt: true,
      transactionId: true,
      txHash: true,
      lastError: true,
    },
  });

  return NextResponse.json({
    withdrawals: rows.map((w) => ({
      id: w.id,
      referenceId: w.referenceId,
      status: w.status,
      displayPhase: withdrawalDisplayPhase({
        status: w.status,
        txHash: w.txHash,
        lastError: w.lastError,
      }),
      amountWld: w.amountWld.toString(),
      amountCrc: w.amountCrc.toString(),
      exchangeRate: w.exchangeRate.toString(),
      commissionCrc: w.commissionCrc.toString(),
      createdAt: w.createdAt.toISOString(),
      transactionId: w.transactionId,
      txHash: w.txHash,
    })),
  });
}
