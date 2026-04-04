'use client';

import { formatCurrency } from '@/constants/exchange';
import { useSession } from 'next-auth/react';
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
} from 'react';
import { formatUnits } from 'viem';

const WLD_DECIMALS = 18;

export type WldBalanceLoadState = 'loading' | 'ready' | 'error';
export type WldBalanceErrorKind = 'no_wallet' | 'rpc' | null;

type WldBalanceContextValue = {
  wei: bigint | null;
  loadState: WldBalanceLoadState;
  errorKind: WldBalanceErrorKind;
  /** Forces a new balance read (e.g. after an on-chain transfer). */
  refetch: () => void;
};

const WldBalanceContext = createContext<WldBalanceContextValue | null>(null);

async function fetchWldBalanceFromApi(): Promise<{
  wei: bigint | null;
  errorKind: WldBalanceErrorKind;
  ok: boolean;
}> {
  try {
    const res = await fetch('/api/wld-balance', {
      cache: 'no-store',
      credentials: 'same-origin',
    });
    const data = (await res.json()) as { balanceWei?: string | number };
    if (!res.ok) {
      return {
        wei: null,
        errorKind: res.status === 401 ? 'no_wallet' : 'rpc',
        ok: false,
      };
    }
    const raw = data.balanceWei;
    const weiStr =
      typeof raw === 'number'
        ? Math.trunc(raw).toString()
        : typeof raw === 'string'
          ? raw
          : undefined;
    if (weiStr === undefined || !/^[0-9]+$/.test(weiStr)) {
      return { wei: null, errorKind: 'rpc', ok: false };
    }
    return { wei: BigInt(weiStr), errorKind: null, ok: true };
  } catch {
    return { wei: null, errorKind: 'rpc', ok: false };
  }
}

/**
 * Mount once under the protected shell so balance is fetched a single time per
 * session visit; child routes swap without remounting this provider.
 */
export function WldBalanceProvider({ children }: { children: React.ReactNode }) {
  const { status } = useSession();
  const [wei, setWei] = useState<bigint | null>(null);
  const [loadState, setLoadState] = useState<WldBalanceLoadState>('loading');
  const [errorKind, setErrorKind] = useState<WldBalanceErrorKind>(null);
  const [refetchNonce, setRefetchNonce] = useState(0);
  const fetchIdRef = useRef(0);

  const refetch = useCallback(() => {
    setRefetchNonce((n) => n + 1);
  }, []);

  /** Refetch when the user returns from another app / tab (not on first paint). */
  const wasHiddenRef = useRef(false);
  useEffect(() => {
    if (status !== 'authenticated') return;

    const onVisibility = () => {
      if (document.visibilityState === 'hidden') {
        wasHiddenRef.current = true;
        return;
      }
      if (document.visibilityState === 'visible' && wasHiddenRef.current) {
        wasHiddenRef.current = false;
        refetch();
      }
    };

    const onPageShow = (e: PageTransitionEvent) => {
      if (e.persisted) refetch();
    };

    document.addEventListener('visibilitychange', onVisibility);
    window.addEventListener('pageshow', onPageShow);
    return () => {
      document.removeEventListener('visibilitychange', onVisibility);
      window.removeEventListener('pageshow', onPageShow);
    };
  }, [status, refetch]);

  useEffect(() => {
    if (status === 'loading') {
      setLoadState('loading');
      return;
    }
    if (status !== 'authenticated') {
      setWei(null);
      setLoadState('error');
      setErrorKind('no_wallet');
      return;
    }

    const id = ++fetchIdRef.current;
    let cancelled = false;

    (async () => {
      setLoadState('loading');
      setErrorKind(null);
      const result = await fetchWldBalanceFromApi();
      if (cancelled || id !== fetchIdRef.current) return;
      if (result.ok && result.wei !== null) {
        setWei(result.wei);
        setLoadState('ready');
        setErrorKind(null);
      } else {
        setWei(null);
        setLoadState('error');
        setErrorKind(result.errorKind);
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [status, refetchNonce]);

  const value = useMemo<WldBalanceContextValue>(
    () => ({ wei, loadState, errorKind, refetch }),
    [wei, loadState, errorKind, refetch],
  );

  return (
    <WldBalanceContext.Provider value={value}>
      {children}
    </WldBalanceContext.Provider>
  );
}

export function useWldBalance(): WldBalanceContextValue {
  const ctx = useContext(WldBalanceContext);
  if (!ctx) {
    throw new Error('useWldBalance must be used within WldBalanceProvider');
  }
  return ctx;
}

function formatWldLabel(
  loadState: WldBalanceLoadState,
  wei: bigint | null,
): string {
  if (loadState === 'loading') return '···';
  if (loadState === 'error' || wei === null) return '—';
  return formatCurrency.WLD(Number(formatUnits(wei, WLD_DECIMALS)));
}

/** Compact chip for `TopBar` `endAdornment`. */
export function WldBalancePill({ className }: { className?: string }) {
  const { wei, loadState, refetch } = useWldBalance();
  const busy = loadState === 'loading';
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => refetch()}
      className={`shrink-0 cursor-pointer touch-manipulation rounded-lg border-0 bg-gray-100 px-2.5 py-1 text-xs font-semibold tabular-nums text-gray-900 transition-opacity focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-gray-400 enabled:active:opacity-70 disabled:cursor-wait disabled:opacity-60 ${className ?? ''}`}
      title="Toca para actualizar · Saldo WLD en World Chain"
      aria-label="Actualizar saldo WLD"
    >
      {formatWldLabel(loadState, wei)}
    </button>
  );
}

/** One line “Saldo … WLD” for landing / CTAs. */
export function WldBalanceInline({ className }: { className?: string }) {
  const { wei, loadState, refetch } = useWldBalance();
  const busy = loadState === 'loading';
  return (
    <button
      type="button"
      disabled={busy}
      onClick={() => refetch()}
      className={`flex w-full max-w-xs cursor-pointer touch-manipulation items-center justify-center gap-2 rounded-lg border-0 bg-transparent py-1.5 text-sm transition-opacity focus-visible:outline focus-visible:outline-offset-2 focus-visible:outline-gray-400 enabled:active:opacity-70 disabled:cursor-wait disabled:opacity-60 ${className ?? ''}`}
      title="Toca para actualizar · Saldo WLD en World Chain"
      aria-label="Actualizar saldo WLD"
    >
      <span className="text-gray-600">Saldo</span>
      <span className="font-semibold tabular-nums text-gray-900">
        {formatWldLabel(loadState, wei)}
      </span>
    </button>
  );
}
