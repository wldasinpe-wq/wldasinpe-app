/**
 * Send ONE real compliance notification email (Resend) using mock withdrawal data.
 * Does not touch the database — use `pnpm test:db-withdrawal` for that.
 *
 * Body matches production (reference_id, wallet, SINPE, amounts, tx fields, UTC, env).
 * Data source: scripts/lib/withdrawal-test-fixture.ts (same persona as DB test script).
 *
 * Usage:
 *   pnpm test:email-compliance
 *
 * Requires in .env.local:
 *   RESEND_API_KEY
 *
 * Optional:
 *   COMPLIANCE_EMAIL_FROM — if unset, uses onboarding@resend.dev (Resend trial sender; recipient rules apply).
 *
 * Recipient for this QA script is fixed below (not COMPLIANCE_EMAIL_TO).
 */

import { sendWithdrawalComplianceEmailFromInput } from '../src/lib/email/send-withdrawal-compliance';
import {
  buildComplianceEmailInputFromMock,
  WITHDRAWAL_TEST_MOCK,
} from './lib/withdrawal-test-fixture';

const TEST_EMAIL_TO = 'wldasinpe@gmail.com';
const RESEND_DEFAULT_FROM = 'onboarding@resend.dev';

async function main() {
  if (!process.env.RESEND_API_KEY?.trim()) {
    console.error('Missing RESEND_API_KEY in .env.local');
    process.exit(1);
  }

  const from =
    process.env.COMPLIANCE_EMAIL_FROM?.trim() || RESEND_DEFAULT_FROM;

  const referenceId = `${WITHDRAWAL_TEST_MOCK.referenceId}_email_${Date.now().toString(36)}`;
  const input = buildComplianceEmailInputFromMock(referenceId);

  console.log('Sending compliance email only (no DB).');
  console.log('  to:  ', TEST_EMAIL_TO);
  console.log('  from:', from);
  console.log('  reference_id:', referenceId);

  const result = await sendWithdrawalComplianceEmailFromInput(input, {
    to: TEST_EMAIL_TO,
    from,
    persistAudit: false,
  });

  if (result.sent) {
    console.log('OK — Resend message id:', result.providerId ?? '(none)');
    return;
  }

  if (result.skipped) {
    console.error('Skipped:', result.reason);
    process.exit(1);
  }

  console.error('Failed:', result.error);
  process.exit(1);
}

void main();
