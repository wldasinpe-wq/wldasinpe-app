import type { Attachment } from 'resend';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { complianceAttachmentsFromDataUrls } from '@/lib/email/compliance-attachments';
import { sendWithdrawalComplianceEmail } from '@/lib/email/send-withdrawal-compliance';
import { prisma } from '@/lib/prisma';
import { getWorldchainTxOutcome } from '@/lib/wld-onchain';
import {
  TRANSACTION_PENDING_ERROR,
  fetchMinikitPaymentTransaction,
} from '@/lib/world-minikit-transaction';

function normalizeWallet(a: string) {
  return a.toLowerCase();
}

function emailOutboxConfigured() {
  return (
    Boolean(process.env.RESEND_API_KEY?.trim()) &&
    Boolean(process.env.COMPLIANCE_EMAIL_TO?.trim()) &&
    Boolean(process.env.COMPLIANCE_EMAIL_FROM?.trim())
  );
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
    const txHashFromClient =
      typeof body.txHash === 'string' && body.txHash.trim()
        ? body.txHash.trim()
        : null;
    const idFrontDataUrl =
      typeof body.idFrontDataUrl === 'string' ? body.idFrontDataUrl : '';
    const idBackDataUrl =
      typeof body.idBackDataUrl === 'string' ? body.idBackDataUrl : '';

    if (!referenceId || !transactionId) {
      return NextResponse.json(
        { error: 'referenceId and transactionId are required' },
        { status: 400 }
      );
    }

    const sendEmail = emailOutboxConfigured();
    if (process.env.NODE_ENV === 'production' && !sendEmail) {
      return NextResponse.json(
        {
          error: 'compliance_email_not_configured',
          message:
            'Set RESEND_API_KEY, COMPLIANCE_EMAIL_FROM, and COMPLIANCE_EMAIL_TO.',
        },
        { status: 503 }
      );
    }

    let complianceAttachments: Attachment[] | undefined;
    let appIdForWorld: string | null = null;

    if (sendEmail) {
      appIdForWorld = process.env.NEXT_PUBLIC_APP_ID?.trim() ?? null;
      if (!appIdForWorld) {
        return NextResponse.json(
          {
            error:
              'NEXT_PUBLIC_APP_ID is required to confirm on-chain payment before email',
          },
          { status: 500 }
        );
      }
      if (!idFrontDataUrl || !idBackDataUrl) {
        return NextResponse.json(
          {
            error:
              'idFrontDataUrl and idBackDataUrl are required when compliance email is configured',
          },
          { status: 400 }
        );
      }
      const parsed = complianceAttachmentsFromDataUrls(
        idFrontDataUrl,
        idBackDataUrl
      );
      if (!parsed) {
        return NextResponse.json(
          { error: 'Invalid or oversized ID image data URLs' },
          { status: 400 }
        );
      }
      complianceAttachments = parsed;
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

    /** On-chain hash: from World API when emailing; otherwise optional client hint for dev. */
    const txHashForSubmitted = sendEmail ? null : txHashFromClient;

    if (withdrawal.status === 'PENDING_PAYMENT') {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          transactionId,
          txHash: txHashForSubmitted,
          status: 'SUBMITTED',
          lastError: null,
        },
      });
    } else if (withdrawal.status === 'SUBMITTED') {
      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          transactionId,
          ...(txHashForSubmitted ? { txHash: txHashForSubmitted } : {}),
          lastError: null,
        },
      });
    } else {
      return NextResponse.json(
        { error: 'invalid_withdrawal_status' },
        { status: 422 }
      );
    }

    let rowForEmail = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });

    if (sendEmail) {
      const appId = appIdForWorld;
      if (!appId) {
        return NextResponse.json(
          { error: 'server_misconfigured' },
          { status: 500 }
        );
      }
      let chainTx;
      try {
        chainTx = await fetchMinikitPaymentTransaction(transactionId, appId);
      } catch (e) {
        console.error('[complete-withdrawal] World transaction lookup:', e);
        return NextResponse.json(
          { error: 'transaction_lookup_failed' },
          { status: 503 }
        );
      }

      if (!chainTx) {
        return NextResponse.json(
          { error: 'transaction_not_found' },
          { status: 404 }
        );
      }

      if (chainTx.reference !== referenceId) {
        return NextResponse.json(
          { error: 'reference_mismatch' },
          { status: 403 }
        );
      }

      const apiHash = chainTx.transaction_hash?.trim() ?? '';
      let confirmedHash: string | null = null;

      if (chainTx.transaction_status === 'mined' && apiHash) {
        confirmedHash = apiHash;
      } else if (apiHash) {
        const outcome = await getWorldchainTxOutcome(apiHash);
        if (outcome === 'success') {
          confirmedHash = apiHash;
        } else if (outcome === 'reverted') {
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: { lastError: 'on_chain_transaction_failed' },
          });
          return NextResponse.json(
            { error: 'on_chain_transaction_failed' },
            { status: 502 }
          );
        }
      }

      if (!confirmedHash) {
        if (chainTx.transaction_status === 'failed') {
          await prisma.withdrawal.update({
            where: { id: withdrawal.id },
            data: {
              lastError: 'on_chain_transaction_failed',
            },
          });
          return NextResponse.json(
            { error: 'on_chain_transaction_failed' },
            { status: 502 }
          );
        }

        if (chainTx.transaction_status === 'pending') {
          return NextResponse.json(
            {
              error: TRANSACTION_PENDING_ERROR,
              transaction_status: 'pending',
            },
            { status: 409 }
          );
        }

        return NextResponse.json(
          {
            error: 'transaction_not_ready',
            transaction_status: chainTx.transaction_status,
          },
          { status: 409 }
        );
      }

      await prisma.withdrawal.update({
        where: { id: withdrawal.id },
        data: {
          txHash: confirmedHash,
        },
      });

      rowForEmail = await prisma.withdrawal.findUniqueOrThrow({
        where: { id: withdrawal.id },
      });
    }

    const emailResult = await sendWithdrawalComplianceEmail(rowForEmail, {
      ...(complianceAttachments?.length
        ? { attachments: complianceAttachments }
        : {}),
    });

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
