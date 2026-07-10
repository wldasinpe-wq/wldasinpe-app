import { auth } from '@/auth';
import { readWldBalanceWei } from '@/lib/wld-onchain';
import type { Session } from 'next-auth';
import { NextResponse } from 'next/server';

function resolveWalletAddress(session: Session | null): `0x${string}` | null {
  const w = session?.user?.walletAddress;
  if (w && /^0x[a-fA-F0-9]{40}$/i.test(w)) {
    return w as `0x${string}`;
  }
  const id = session?.user?.id;
  if (id && /^0x[a-fA-F0-9]{40}$/i.test(id)) {
    return id as `0x${string}`;
  }
  return null;
}

/**
 * Returns the authenticated user's WLD balance on World Chain (wei as string).
 * Zero balance returns 200 with balanceWei "0".
 */
export async function GET() {
  const session = await auth();
  const addr = resolveWalletAddress(session);
  if (!addr) {
    return NextResponse.json({ error: 'no_wallet' }, { status: 401 });
  }

  try {
    const wei = await readWldBalanceWei(addr);
    return NextResponse.json({ balanceWei: wei.toString() });
  } catch (err) {
    const isDev = process.env.NODE_ENV === 'development';
    if (isDev) {
      console.error('[api/wld-balance] readContract failed:', err);
    }
    const detail =
      isDev && err instanceof Error
        ? [err.message, err.cause instanceof Error ? err.cause.message : '']
            .filter(Boolean)
            .join(' · ')
            .slice(0, 600)
        : undefined;
    return NextResponse.json(
      detail
        ? { error: 'rpc_failed', detail }
        : { error: 'rpc_failed' },
      { status: 502 },
    );
  }
}
