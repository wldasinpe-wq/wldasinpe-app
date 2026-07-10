import type { Attachment } from 'resend';
import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  calculateConversionFromQuote,
  LIMITS,
} from '@/constants/exchange';
import { getExchangeQuote } from '@/lib/exchange/get-quote';
import type { ExchangeQuote } from '@/lib/exchange/types';
import { complianceAttachmentsFromDataUrls } from '@/lib/email/compliance-attachments';
import { sendWithdrawalComplianceEmail } from '@/lib/email/send-withdrawal-compliance';
import { prisma } from '@/lib/prisma';

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
  const contactEmailRaw = body.contactEmail;
  const contactEmail =
    typeof contactEmailRaw === 'string' && contactEmailRaw.trim()
      ? contactEmailRaw.trim()
      : null;

  if (
    !isNonEmptyString(phoneNumber) ||
    !isNonEmptyString(firstName) ||
    !isNonEmptyString(idNumber)
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
  quote: ExchangeQuote
) {
  const conversion = calculateConversionFromQuote(quote, draft.amount);
  const idSubmittedAt =
    draft.idFrontSubmitted && draft.idBackSubmitted ? new Date() : null;

  return {
    referenceId,
    walletAddress,
    firstName: draft.firstName,
    lastName: draft.lastName,
    idNumber: draft.idNumber,
    phoneNumber: draft.phoneNumber,
    amountWld: new Prisma.Decimal(draft.amount),
    amountCrc: new Prisma.Decimal(conversion.netCrc),
    exchangeRate: new Prisma.Decimal(quote.wldToCrc),
    exchangeRateSource: quote.source,
    exchangeRateFetchedAt: (() => {
      const d = new Date(quote.fetchedAt);
      return Number.isNaN(d.getTime()) ? null : d;
    })(),
    commissionCrc: new Prisma.Decimal(conversion.fee),
    idFrontSubmitted: draft.idFrontSubmitted,
    idBackSubmitted: draft.idBackSubmitted,
    idSubmittedAt,
    contactEmail: draft.contactEmail,
    transactionId,
    txHash: null,
    status: 'SUBMITTED' as const,
    lastError: null,
  };
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

    if (sendEmail) {
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
              'Include phoneNumber, amountWLD, firstName, lastName, idNumber, idFrontSubmitted, idBackSubmitted, contactEmail (optional).',
          },
          { status: 400 }
        );
      }
      const { draft } = parsed;

      const quote = await getExchangeQuote();
      if (quote.wldToCrc <= 0) {
        return NextResponse.json(
          { error: 'exchange_rate_unavailable' },
          { status: 503 }
        );
      }

      try {
        await prisma.withdrawal.create({
          data: buildWithdrawalCreateData(
            referenceId,
            walletAddress,
            draft,
            transactionId,
            quote
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

    if (!createdThisRequest) {
      if (withdrawal.status === 'PENDING_PAYMENT') {
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            transactionId,
            status: 'SUBMITTED',
            lastError: null,
          },
        });
      } else if (withdrawal.status === 'SUBMITTED') {
        await prisma.withdrawal.update({
          where: { id: withdrawal.id },
          data: {
            transactionId,
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

    const emailResult = await sendWithdrawalComplianceEmail(withdrawal, {
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
