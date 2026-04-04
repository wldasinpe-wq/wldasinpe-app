# WLD -> CRC Withdrawal Steps

This is the current withdrawal flow in the repo, documented to make it easy to add new steps later.

## Step 0 - Access control

Technical: User must be authenticated in protected routes under `src/app/(protected)/*` before entering the withdrawal flow.  
What it does: Ensures only logged-in users can initiate a withdrawal.

## Step 1 - Start withdrawal

Technical: User taps the CTA in `src/app/(protected)/home/page.tsx` and navigates to `/withdraw/phone`.  
What it does: Starts the guided withdrawal flow.

## Step 2 - Enter SINPE phone

Technical: `PhoneStep` validates Costa Rica phone format and stores `sinpe_phone` in `sessionStorage`.  
What it does: Captures the destination phone number for the SINPE payout.

## Step 3 - Confirm destination account

Technical: `ConfirmStep` reads `sinpe_phone`, loads recipient preview data, and gates progression to the ID capture step (e.g. `/withdraw/id`).  
What it does: Lets the user verify recipient details before sending funds.

## Step 4 - Capture ID images

Technical: User captures or selects two images in sequence—ID front, then ID bottom/back—then submits (upload to storage and/or attach to withdrawal draft via API); on success, navigate to `/withdraw/amount`.  
What it does: Collects identity documentation required for compliance before the user enters how much to withdraw.

## Step 5 - Enter amount

Technical: `AmountStep` captures WLD amount, validates limits/balance, and computes estimated CRC using exchange constants.  
What it does: Defines how much value will be withdrawn and shows expected payout.

## Step 6 - Create withdrawal reference

Technical: Add a dedicated screen (e.g. `/withdraw/review` or `/withdraw/initiate`) that shows a short summary (phone, amount, estimated CRC); on submit it calls `POST /api/initiate-payment` (or a renamed `initiate-withdrawal` route), receives the reference id, then hands off to the on-chain step (Step 7).  
What it does: Makes withdrawal creation visible in the product flow and creates the server-side reference the user will attach to the chain transaction.

## Step 7 - Send on-chain transfer

Technical: After Step 6 returns the reference id, a client pay step (dedicated screen or continuation on the same screen) calls `MiniKit.commandsAsync.pay()` to transfer WLD to the Ridivi wallet using that reference.  
What it does: Moves user funds on-chain to the service wallet.

## Step 8 - Send compliance email (provider / Ridivi)

Technical: After the on-chain transfer succeeds, the server **persists the outcome in Neon Postgres** (via Prisma): update `withdrawals` with `transaction_id`, `tx_hash` (when known), amounts, and status toward `emailed`/`completed` as you define it, and record chain details in `transactions` if you use a separate table—same fields you will put in the email so DB and notification stay aligned. Then send the transactional email (recommended: **Resend**, per `docs/INFRA_RECOMMENDATIONS.md`) to the configured Ridivi inbox; use an idempotency key (`reference_id` or `transaction_id`), append rows to `email_events` for every attempt, and retry failures with backoff. Email body must include at minimum: `reference_id`, wallet address, SINPE phone, WLD and CRC amounts, `tx_hash` (when available), UTC timestamp, and environment (`prod`/`staging`). In production, gate this whole step on **confirmed/mined** status once polling exists (see Step 11)—until then, run from the MiniKit pay success path and backfill `tx_hash` when available.  
What it does: Saves the authoritative withdrawal and transaction record in your database, then notifies Ridivi with the same data so they can execute the CRC payout, with a full audit trail (`email_events` + row updates).

## Step 9 - UX completion

Technical: On success, UI clears temporary phone data and redirects user to `/home`; on failure/cancel it shows feedback state.  
What it does: Closes the user flow with a clear success/failure outcome.

---

## Reusable step component structure (implemented)

- `src/components/WithdrawSteps/PhoneStep.tsx`
- `src/components/WithdrawSteps/ConfirmStep.tsx`
- `src/components/WithdrawSteps/IdCaptureStep.tsx` (to add: front + bottom ID photos, submit, then `/withdraw/amount`)
- `src/components/WithdrawSteps/AmountStep.tsx`
- `src/components/WithdrawSteps/InitiateWithdrawalStep.tsx` (to add: summary screen + `POST` initiate → reference id for pay)
- `src/components/WithdrawSteps/ui/StepProgress.tsx`
- `src/components/WithdrawSteps/ui/StepHeader.tsx`
- `src/components/WithdrawSteps/ui/InfoBox.tsx`
- Server: DB + email + audit (to add: Prisma update to `withdrawals`/`transactions`, then Resend via `src/lib/email/` or `POST` route / job; `email_events` per `docs/INFRA_RECOMMENDATIONS.md`)

This keeps each step logic in one component and shared UI in reusable subcomponents.

---

## Next steps to add (recommended)

## Step 10 - Persist transaction data

Technical: Save user metadata + withdrawal + tx status in Neon Postgres (via Prisma) when **initiating** (Step 6) and when **confirming mined** (Step 11); Step 8 must **finalize or reconcile** those rows with the same payload used for the compliance email.  
What it does: Gives traceability, auditability, support tooling, and retry safety across the full lifecycle (draft → on-chain → emailed).

## Step 11 - Confirm on-chain status

Technical: After MiniKit returns `transaction_id`, poll/get transaction status and mark withdrawal as `confirmed` when mined; then align Step 8 so the compliance email runs only after this confirmation (see reliability pattern in `docs/INFRA_RECOMMENDATIONS.md`).  
What it does: Guarantees downstream actions only run for successful on-chain transfers.
