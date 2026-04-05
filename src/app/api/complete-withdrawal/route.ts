import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { sendWithdrawalComplianceEmail } from '@/lib/email/send-withdrawal-compliance';
import { prisma } from '@/lib/prisma';

function normalizeWallet(a: string) {
  return a.toLowerCase();
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionWallet = normalizeWallet(session.user.walletAddress);

  try {
    const body = (await req.json()) as Record<string, unknown>;
    const referenceId =
      typeof body.referenceId === 'string' ? body.referenceId.trim() : '';
    const transactionId =
      typeof body.transactionId === 'string' ? body.transactionId.trim() : '';
    const txHash =
      typeof body.txHash === 'string' && body.txHash.trim()
        ? body.txHash.trim()
        : null;

    if (!referenceId || !transactionId) {
      return NextResponse.json(
        { error: 'referenceId and transactionId are required' },
        { status: 400 }
      );
    }

    const withdrawal = await prisma.withdrawal.findUnique({
      where: { referenceId },
    });

    if (!withdrawal) {
      return NextResponse.json({ error: 'Withdrawal not found' }, { status: 404 });
    }

    if (normalizeWallet(withdrawal.walletAddress) !== sessionWallet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (withdrawal.status === 'EMAILED') {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    if (withdrawal.status === 'PENDING_PAYMENT') {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          transactionId,
          txHash,
          status: 'SUBMITTED',
          lastError: null,
        },
      });
    } else if (withdrawal.status === 'SUBMITTED') {
      // Email retry path: keep existing chain fields unless client sends updates
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          transactionId,
          ...(txHash ? { txHash } : {}),
          lastError: null,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'Withdrawal cannot be completed' },
        { status: 409 }
      );
    }

    const fresh = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });

    const emailResult = await sendWithdrawalComplianceEmail(fresh);

    if (emailResult.sent) {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          status: 'EMAILED',
          lastError: null,
        },
      });
      return NextResponse.json({ ok: true, emailed: true });
    }

    if (emailResult.skipped) {
      // Dev / misconfig: chain + DB are updated; compliance inbox not notified
      return NextResponse.json({
        ok: true,
        emailed: false,
        emailSkipped: true,
        reason: emailResult.reason,
      });
    }

    await prisma.withdrawal.update({
      where: { id: withdrawal.id },
      data: {
        lastError: emailResult.error.slice(0, 500),
      },
    });
    return NextResponse.json(
      { error: 'Failed to send compliance email', detail: emailResult.error },
      { status: 502 }
    );
  } catch (error) {
    console.error('Error completing withdrawal:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
