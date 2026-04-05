import type { Attachment } from 'resend';
import { Resend } from 'resend';

import type { Withdrawal } from '@prisma/client';

import { prisma } from '@/lib/prisma';

import {
  buildComplianceEmailPlainText,
  buildComplianceEmailSubject,
  withdrawalToComplianceInput,
  type WithdrawalComplianceEmailInput,
} from './compliance-content';

export type SendComplianceResult =
  | { sent: true; providerId?: string; emailEventId?: string }
  | { sent: false; skipped: true; reason: string; emailEventId?: string }
  | { sent: false; skipped: false; error: string; emailEventId?: string };

export type SendWithdrawalComplianceOptions = {
  /** Override recipient (production: COMPLIANCE_EMAIL_TO). */
  to?: string;
  /** Override sender (production: COMPLIANCE_EMAIL_FROM). */
  from?: string;
  /** Links audit row to withdrawals.id */
  withdrawalId?: string | null;
  /**
   * When true (default), append `email_events` for each attempt per INFRA_RECOMMENDATIONS.md.
   */
  persistAudit?: boolean;
  /** ID photos (frente / reverso), e.g. from complete-withdrawal. */
  attachments?: Attachment[];
};

async function createEmailEvent(data: {
  withdrawalId?: string | null;
  referenceId: string;
  status: 'QUEUED' | 'SENT' | 'FAILED' | 'SKIPPED';
  toAddress: string;
  fromAddress: string;
  providerMessageId?: string | null;
  errorMessage?: string | null;
}) {
  return prisma.emailEvent.create({
    data: {
      referenceId: data.referenceId,
      status: data.status,
      toAddress: data.toAddress,
      fromAddress: data.fromAddress,
      providerMessageId: data.providerMessageId ?? undefined,
      errorMessage: data.errorMessage ?? undefined,
      ...(data.withdrawalId != null && data.withdrawalId !== ''
        ? { withdrawalId: data.withdrawalId }
        : {}),
    },
  });
}

async function updateEmailEvent(
  id: string,
  data: {
    status: 'SENT' | 'FAILED' | 'SKIPPED';
    providerMessageId?: string | null;
    errorMessage?: string | null;
  }
) {
  return prisma.emailEvent.update({
    where: { id },
    data: {
      status: data.status,
      providerMessageId: data.providerMessageId ?? undefined,
      errorMessage: data.errorMessage ?? undefined,
    },
  });
}

/**
 * Sends compliance notification from a plain input (e.g. test script or jobs).
 */
export async function sendWithdrawalComplianceEmailFromInput(
  input: WithdrawalComplianceEmailInput,
  options?: SendWithdrawalComplianceOptions
): Promise<SendComplianceResult> {
  const apiKey = process.env.RESEND_API_KEY;
  const envTo = process.env.COMPLIANCE_EMAIL_TO;
  const envFrom = process.env.COMPLIANCE_EMAIL_FROM;
  const to = options?.to ?? envTo;
  const from = options?.from ?? envFrom;
  const persistAudit = options?.persistAudit !== false;
  const withdrawalId = options?.withdrawalId ?? undefined;
  const attachments = options?.attachments;

  const timestampUtc = new Date();
  const text = buildComplianceEmailPlainText(input, timestampUtc);
  const subject = buildComplianceEmailSubject(input);

  const recordSkipped = async (reason: string, detail?: string) => {
    if (!persistAudit) {
      return {
        sent: false as const,
        skipped: true as const,
        reason,
      };
    }
    try {
      const ev = await createEmailEvent({
        withdrawalId,
        referenceId: input.referenceId,
        status: 'SKIPPED',
        toAddress: to ?? '(not configured)',
        fromAddress: from ?? '(not configured)',
        errorMessage: detail ?? reason,
      });
      return {
        sent: false as const,
        skipped: true as const,
        reason,
        emailEventId: ev.id,
      };
    } catch (e) {
      console.error('[email_events] SKIPPED persist failed', e);
      return { sent: false as const, skipped: true as const, reason };
    }
  };

  if (!apiKey || !to || !from) {
    console.warn(
      '[compliance-email] Missing RESEND_API_KEY, recipient, or COMPLIANCE_EMAIL_FROM; not sending.'
    );
    console.info('[compliance-email] Would have sent:\n', text);
    return recordSkipped(
      'email_not_configured',
      !apiKey
        ? 'missing_RESEND_API_KEY'
        : !to
          ? 'missing_recipient'
          : 'missing_COMPLIANCE_EMAIL_FROM'
    );
  }

  let queuedId: string | null = null;
  if (persistAudit) {
    try {
      const ev = await createEmailEvent({
        withdrawalId,
        referenceId: input.referenceId,
        status: 'QUEUED',
        toAddress: to,
        fromAddress: from,
      });
      queuedId = ev.id;
    } catch (e) {
      console.error('[email_events] QUEUED persist failed', e);
    }
  }

  try {
    const resend = new Resend(apiKey);
    const { data, error } = await resend.emails.send(
      {
        from,
        to: [to],
        subject,
        text,
        ...(attachments?.length ? { attachments } : {}),
      },
      { idempotencyKey: input.referenceId }
    );

    if (error) {
      const msg = error.message ?? 'resend_error';
      if (queuedId) {
        try {
          await updateEmailEvent(queuedId, {
            status: 'FAILED',
            errorMessage: msg.slice(0, 2000),
          });
        } catch (e) {
          console.error('[email_events] FAILED update failed', e);
        }
      } else if (persistAudit) {
        try {
          await createEmailEvent({
            withdrawalId,
            referenceId: input.referenceId,
            status: 'FAILED',
            toAddress: to,
            fromAddress: from,
            errorMessage: msg.slice(0, 2000),
          });
        } catch (e) {
          console.error('[email_events] FAILED create failed', e);
        }
      }
      return {
        sent: false,
        skipped: false,
        error: msg,
        emailEventId: queuedId ?? undefined,
      };
    }

    if (queuedId) {
      try {
        await updateEmailEvent(queuedId, {
          status: 'SENT',
          providerMessageId: data?.id ?? null,
        });
      } catch (e) {
        console.error('[email_events] SENT update failed', e);
      }
    } else if (persistAudit) {
      try {
        await createEmailEvent({
          withdrawalId,
          referenceId: input.referenceId,
          status: 'SENT',
          toAddress: to,
          fromAddress: from,
          providerMessageId: data?.id ?? null,
        });
      } catch (e) {
        console.error('[email_events] SENT create failed', e);
      }
    }

    return { sent: true, providerId: data?.id, emailEventId: queuedId ?? undefined };
  } catch (e) {
    const message = e instanceof Error ? e.message : 'unknown_error';
    if (queuedId) {
      try {
        await updateEmailEvent(queuedId, {
          status: 'FAILED',
          errorMessage: message.slice(0, 2000),
        });
      } catch (err) {
        console.error('[email_events] FAILED update failed', err);
      }
    } else if (persistAudit) {
      try {
        await createEmailEvent({
          withdrawalId,
          referenceId: input.referenceId,
          status: 'FAILED',
          toAddress: to,
          fromAddress: from,
          errorMessage: message.slice(0, 2000),
        });
      } catch (err) {
        console.error('[email_events] FAILED create failed', err);
      }
    }
    return {
      sent: false,
      skipped: false,
      error: message,
      emailEventId: queuedId ?? undefined,
    };
  }
}

/**
 * Sends the internal compliance notification for a persisted withdrawal row.
 */
export async function sendWithdrawalComplianceEmail(
  row: Withdrawal,
  options?: SendWithdrawalComplianceOptions
): Promise<SendComplianceResult> {
  const input = withdrawalToComplianceInput(row);
  return sendWithdrawalComplianceEmailFromInput(input, {
    ...options,
    withdrawalId: options?.withdrawalId ?? row.id,
  });
}
