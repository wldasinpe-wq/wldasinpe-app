import type { Attachment } from 'resend';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  calculateConversion,
  EXCHANGE_RATES,
  LIMITS,
} from '@/constants/exchange';
import { complianceAttachmentsFromDataUrls } from '@/lib/email/compliance-attachments';
import { sendWithdrawalComplianceEmail } from '@/lib/email/send-withdrawal-compliance';
import { prisma } from '@/lib/prisma';
import { getWorldchainTxOutcome } from '@/lib/wld-onchain';
import {
  TRANSACTION_NOT_READY_ERROR,
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

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

type DraftWithdrawal = {
  phoneNumber: string;
  amount: number;
  firstName: string;
  lastName: string;
  idNumber: string;
  accountNumber: string;
  contactEmail: string | null;
  idFrontSubmitted: boolean;
  idBackSubmitted: boolean;
};

function parseDraftWithdrawal(
  body: Record<string, unknown>
): { ok: true; draft: DraftWithdrawal } | { ok: false } {
  const phoneNumber = body.phoneNumber;
  const amountWLD = body.amountWLD;
  const firstName = body.firstName;
  const lastNameRaw = body.lastName;
  const idNumber = body.idNumber;
  const accountNumber = body.accountNumber;
  const contactEmailRaw = body.contactEmail;
  const contactEmail =
    typeof contactEmailRaw === 'string' && contactEmailRaw.trim()
      ? contactEmailRaw.trim()
      : null;

  if (
    !isNonEmptyString(phoneNumber) ||
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(idNumber) ||
    !isNonEmptyString(accountNumber)
  ) {
    return { ok: false };
  }

  const amount =
    typeof amountWLD === 'string' ? parseFloat(amountWLD) : Number(amountWLD);
  if (!Number.isFinite(amount) || amount < LIMITS.MIN_WLD) {
    return { ok: false };
  }

  const lastName =
    typeof lastNameRaw === 'string' ? lastNameRaw.trim() : '';

  return {
    ok: true,
    draft: {
      phoneNumber: phoneNumber.trim(),
      amount,
      firstName: firstName.trim(),
      lastName,
      idNumber: idNumber.trim(),
      accountNumber: accountNumber.trim(),
      contactEmail,
      idFrontSubmitted: Boolean(body.idFrontSubmitted),
      idBackSubmitted: Boolean(body.idBackSubmitted),
    },
  };
}

function buildWithdrawalCreateData(
  referenceId: string,
  walletAddress: string,
  draft: DraftWithdrawal,
  transactionId: string,
  txHash: string | null
) {
  const conversion = calculateConversion(draft.amount);
  const idSubmittedAt =
    draft.idFrontSubmitted && draft.idBackSubmitted ? new Date() : null;

  return {
    referenceId,
    walletAddress,
    firstName: draft.firstName,
    lastName: draft.lastName,
    idNumber: draft.idNumber,
    phoneNumber: draft.phoneNumber,
    accountNumber: draft.accountNumber,
    amountWld: new Prisma.Decimal(draft.amount),
    amountCrc: new Prisma.Decimal(conversion.netCrc),
    exchangeRate: new Prisma.Decimal(EXCHANGE_RATES.WLD_TO_CRC),
    commissionCrc: new Prisma.Decimal(conversion.fee),
    idFrontSubmitted: draft.idFrontSubmitted,
    idBackSubmitted: draft.idBackSubmitted,
    idSubmittedAt,
    contactEmail: draft.contactEmail,
    transactionId,
    txHash,
    status: 'SUBMITTED' as const,
    lastError: null,
  };
}

/**
 * Resolves a confirmed tx hash from World + World Chain, optionally updating
 * an existing row on failure.
 */
async function resolveConfirmedHashFromWorld(
  transactionId: string,
  referenceId: string,
  appId: string,
  withdrawalIdForFailure: string | null
): Promise<
  | { ok: true; confirmedHash: string }
  | { ok: false; response: Response }
> {
  let chainTx;
  try {
    chainTx = await fetchMinikitPaymentTransaction(transactionId, appId);
  } catch (e) {
    console.error('[complete-withdrawal] World transaction lookup:', e);
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'transaction_lookup_failed' },
        { status: 503 }
      ),
    };
  }

  if (!chainTx) {
    return {
      ok: false,
      response: NextResponse.json(
        { error: 'transaction_not_found' },
        { status: 404 }
      ),
    };
  }

  if (chainTx.reference !== referenceId) {
    return {
      ok: false,
      response: NextResponse.json({ error: 'reference_mismatch' }, { status: 403 }),
    };
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
      if (withdrawalIdForFailure) {
        await prisma.withdrawal.update({
          where: { id: withdrawalIdForFailure },
          data: { lastError: 'on_chain_transaction_failed' },
        });
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'on_chain_transaction_failed' },
          { status: 502 }
        ),
      };
    }
  }

  if (!confirmedHash) {
    if (chainTx.transaction_status === 'failed') {
      if (withdrawalIdForFailure) {
        await prisma.withdrawal.update({
          where: { id: withdrawalIdForFailure },
          data: {
            lastError: 'on_chain_transaction_failed',
          },
        });
      }
      return {
        ok: false,
        response: NextResponse.json(
          { error: 'on_chain_transaction_failed' },
          { status: 502 }
        ),
      };
    }

    if (chainTx.transaction_status === 'pending') {
      return {
        ok: false,
        response: NextResponse.json(
          {
            error: TRANSACTION_PENDING_ERROR,
            transaction_status: 'pending',
          },
          { status: 409 }
        ),
      };
    }

    return {
      ok: false,
      response: NextResponse.json(
        {
          error: TRANSACTION_NOT_READY_ERROR,
          transaction_status: chainTx.transaction_status,
        },
        { status: 409 }
      ),
    };
  }

  return { ok: true, confirmedHash };
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.walletAddress) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const sessionWallet = normalizeWallet(session.user.walletAddress);
  const walletAddress = session.user.walletAddress;

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

    let withdrawal = await prisma.withdrawal.findUnique({
      where: { referenceId },
    });

    let createdThisRequest = false;

    if (!withdrawal) {
      const parsed = parseDraftWithdrawal(body);
      if (!parsed.ok) {
        return NextResponse.json(
          {
            error: 'draft_withdrawal_required',
            message:
              'Include phoneNumber, amountWLD, firstName, lastName, idNumber, accountNumber, idFrontSubmitted, idBackSubmitted, contactEmail (optional).',
          },
          { status: 400 }
        );
      }
      const { draft } = parsed;

      if (sendEmail) {
        if (!appIdForWorld) {
          return NextResponse.json(
            { error: 'server_misconfigured' },
            { status: 500 }
          );
        }
        const chain = await resolveConfirmedHashFromWorld(
          transactionId,
          referenceId,
          appIdForWorld,
          null
        );
        if (!chain.ok) {
          return chain.response;
        }

        try {
          await prisma.withdrawal.create({
            data: buildWithdrawalCreateData(
              referenceId,
              walletAddress,
              draft,
              transactionId,
              chain.confirmedHash
            ),
          });
          createdThisRequest = true;
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            createdThisRequest = false;
          } else {
            throw e;
          }
        }
      } else {
        if (!txHashFromClient) {
          return NextResponse.json(
            {
              error: 'txHash is required when compliance email is not configured',
            },
            { status: 400 }
          );
        }
        try {
          await prisma.withdrawal.create({
            data: buildWithdrawalCreateData(
              referenceId,
              walletAddress,
              draft,
              transactionId,
              txHashFromClient
            ),
          });
          createdThisRequest = true;
        } catch (e) {
          if (
            e instanceof Prisma.PrismaClientKnownRequestError &&
            e.code === 'P2002'
          ) {
            createdThisRequest = false;
          } else {
            throw e;
          }
        }
      }

      withdrawal = await prisma.withdrawal.findUnique({
        where: { referenceId },
      });
      if (!withdrawal) {
        return NextResponse.json(
          { error: 'Withdrawal not found' },
          { status: 500 }
        );
      }
    }

    if (normalizeWallet(withdrawal.walletAddress) !== sessionWallet) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    if (withdrawal.status === 'EMAILED') {
      return NextResponse.json({ ok: true, idempotent: true });
    }

    const txHashForSubmitted = sendEmail ? null : txHashFromClient;

    if (!createdThisRequest) {
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
    }

    withdrawal = await prisma.withdrawal.findUniqueOrThrow({
      where: { id: withdrawal.id },
    });

    let rowForEmail = withdrawal;

    if (sendEmail) {
      const appId = appIdForWorld;
      if (!appId) {
        return NextResponse.json(
          { error: 'server_misconfigured' },
          { status: 500 }
        );
      }

      if (!withdrawal.txHash?.trim()) {
        const chain = await resolveConfirmedHashFromWorld(
          transactionId,
          referenceId,
          appId,
          withdrawal.id
        );
        if (!chain.ok) {
          return chain.response;
        }

        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            txHash: chain.confirmedHash,
          },
        });

        rowForEmail = await prisma.withdrawal.findUniqueOrThrow({
          where: { id: withdrawal.id },
        });
      }
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
