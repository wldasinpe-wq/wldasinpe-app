#!/usr/bin/env bash
# Prisma CLI only reads `.env` by default, not `.env.local` (Next.js).
# Load both when DATABASE_URL is unset so local `pnpm db:*` matches the app.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"
PRISMA_BIN="$ROOT/node_modules/.bin/prisma"

if [[ -z "${DATABASE_URL:-}" ]]; then
  set -a
  [[ -f .env ]] && . ./.env
  [[ -f .env.local ]] && . ./.env.local
  set +a
fi

if [[ -z "${DATABASE_URL:-}" ]]; then
  if [[ "${1:-}" == "generate" ]]; then
    # Only schema parsing is needed; no live connection.
    export DATABASE_URL='postgresql://prisma:prisma@127.0.0.1:5432/prisma_placeholder'
  else
    echo 'DATABASE_URL is not set. Add it to .env or .env.local (see .env.sample), then retry.' >&2
    exit 1
  fi
fi

exec "$PRISMA_BIN" "$@"
