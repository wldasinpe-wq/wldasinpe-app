# Infrastructure Recommendations (DB + Email)

## 1) Database (Vercel app + Neon Postgres)

Recommended stack: **Neon Postgres + Prisma ORM + Next.js on Vercel**.

Why:
- Keeps the app fully compatible with Vercel deployment and serverless functions.
- Neon is native PostgreSQL, so data model and SQL stay portable.
- Prisma gives typed models, migrations, and clean schema evolution.
- You can later migrate to self-hosted VPS Postgres by changing connection strings and running migrations.

Suggested rollout:
1. **Now:** Vercel + Neon (free tier) for MVP and early production.
2. **Growth:** keep same Prisma schema, add indexes and observability.
3. **Scale later:** move to dedicated Postgres (VPS/managed) if cost/compliance requires it.

Operational notes (important):
- Use pooled connection string for runtime in Vercel (`DATABASE_URL`).
- Use direct/non-pooled connection string for migrations (`DIRECT_DATABASE_URL`).
- Keep DB as source of truth; use KV only for caching/locks/rate-limits.

Core table proposal:
- `users` (wallet/user metadata)
- `withdrawals` (phone, amount, status lifecycle, reference)
- `transactions` (transaction_id, tx_hash, chain status)
- `email_events` (queued/sent/failed for compliance email audit)

Minimum `withdrawals` columns:
- `id` UUID (PK)
- `reference_id` text unique
- `user_id` UUID (FK)
- `wallet_address` text
- `phone_number` text
- `amount_wld` numeric(18,8)
- `amount_crc_estimated` numeric(18,2)
- `transaction_id` text nullable
- `tx_hash` text nullable
- `status` text (`pending|submitted|mined|emailed|failed`)
- `created_at` timestamptz
- `updated_at` timestamptz

## 2) Email service after tx confirmation

Recommended service: **Resend** (primary) with **SMTP fallback** support.

Why:
- High deliverability and strong developer ergonomics for transactional emails.
- Simple API from Next.js server routes and easy domain setup (SPF/DKIM/DMARC).
- Good reliability for compliance-style notifications with predictable templates.

Reliability pattern:
1. Send email only when tx status is confirmed/mined.
2. Use idempotency key (`reference_id` or `transaction_id`) to avoid duplicates.
3. Persist all send attempts in `email_events`.
4. Retry failed sends with exponential backoff (background job/cron).

Compliance fields to include in every email:
- `reference_id`
- user wallet address
- user phone number (SINPE)
- amount WLD and CRC estimate/final
- tx hash
- timestamp (UTC)
- app environment (prod/staging)

---

## 3) Optional migration path (Neon -> VPS Postgres)

To stay migration-safe from day one:
- Avoid vendor-specific SQL features unless necessary.
- Keep Prisma migrations in git and run them in CI.
- Export with `pg_dump` and restore with `pg_restore` when moving.
- Keep the same table/column naming conventions across environments.
