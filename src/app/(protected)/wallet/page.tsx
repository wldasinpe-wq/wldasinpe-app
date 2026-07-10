'use client';

import { Page } from '@/components/PageLayout';
import { useWldBalance, WldBalancePill } from '@/components/WldBalanceDisplay';
import { buildWorldAddWldFundsUrl } from '@/lib/world-add-funds-url';
import { Button, TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { useSession } from 'next-auth/react';
import {
  hapticError,
  hapticPrimary,
  hapticSelection,
  hapticSuccess,
} from '@/lib/haptics';
import { useCallback, useMemo, useState } from 'react';
import { formatUnits } from 'viem';

const WLD_DECIMALS = 18;

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

export default function WalletPage() {
  const { data: session, status: sessionStatus } = useSession();
  const { wei, loadState, errorKind, refetch } = useWldBalance();
  const [copied, setCopied] = useState(false);

  const address = session?.user?.walletAddress ?? '';

  const balanceDisplay = useMemo(() => {
    if (loadState === 'loading') {
      return { kind: 'loading' as const };
    }
    if (loadState === 'error' || wei === null) {
      return {
        kind: 'error' as const,
        message:
          errorKind === 'no_wallet' ? 'Sin billetera' : 'No disponible',
      };
    }
    const n = Number(formatUnits(wei, WLD_DECIMALS));
    return {
      kind: 'ready' as const,
      amount: n.toLocaleString('es-CR', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 6,
      }),
    };
  }, [loadState, wei, errorKind]);

  const addFundsUrl = useMemo(() => {
    if (!address || !/^0x[a-fA-F0-9]{40}$/i.test(address)) return null;
    return buildWorldAddWldFundsUrl({
      recipientAddress: address,
      returnPath: '/wallet',
    });
  }, [address]);

  const copyAddress = useCallback(async () => {
    if (!address) return;
    try {
      await navigator.clipboard.writeText(address);
      hapticSuccess();
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticError();
      setCopied(false);
    }
  }, [address]);

  const openAddFunds = useCallback(() => {
    if (!addFundsUrl) return;
    hapticPrimary();
    window.open(addFundsUrl, '_blank', 'noopener,noreferrer');
  }, [addFundsUrl]);

  if (sessionStatus === 'loading') {
    return (
      <>
        <Page.Header className="p-0">
          <TopBar title="Billetera" />
        </Page.Header>
        <Page.Main className="flex flex-col gap-6 px-6 py-8 pb-28">
          <p className="text-center text-sm text-gray-600">Cargando sesión…</p>
        </Page.Main>
      </>
    );
  }

  if (sessionStatus !== 'authenticated' || !address) {
    return (
      <>
        <Page.Header className="p-0">
          <TopBar title="Billetera" />
        </Page.Header>
        <Page.Main className="flex flex-col gap-6 px-6 py-8 pb-28">
          <p className="text-center text-sm text-gray-600">
            Iniciá sesión con tu billetera para ver esta pantalla.
          </p>
        </Page.Main>
      </>
    );
  }

  return (
    <>
      <Page.Header className="p-0">
        <TopBar title="Billetera" endAdornment={<WldBalancePill />} />
      </Page.Header>
      <Page.Main className="flex flex-col gap-6 px-6 py-8 pb-28">
        <div
          className="w-full max-w-md mx-auto rounded-2xl p-5 space-y-4 shadow-sm flex flex-col items-center text-center"
          style={{ background: 'var(--white-ridivi)' }}
        >
          <div className="w-full">
            <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
              Dirección de la billetera
            </p>
            <p className="mt-1 font-mono text-sm text-gray-900 break-all">
              {shortenAddress(address)}
            </p>
            <p className="mt-2 font-mono text-[11px] text-gray-600 break-all leading-relaxed">
              {address}
            </p>
          </div>
          <Button
            size="sm"
            variant="secondary"
            className="mt-1"
            onClick={() => void copyAddress()}
            aria-label={
              copied
                ? 'Dirección copiada al portapapeles'
                : 'Copiar dirección completa al portapapeles'
            }
          >
            {copied ? 'Copiado' : 'Copiar dirección'}
          </Button>
        </div>

        <div
          className="w-full max-w-md mx-auto rounded-2xl p-6 shadow-sm"
          style={{ background: 'var(--white-ridivi)' }}
        >
          <div className="flex items-center justify-between gap-3 mb-1">
            <span className="text-sm font-semibold text-gray-900">Saldo</span>
            <Button
              size="sm"
              variant="secondary"
              type="button"
              disabled={balanceDisplay.kind === 'loading'}
              onClick={() => {
                hapticSelection();
                refetch();
              }}
            >
              Actualizar
            </Button>
          </div>
          <p className="text-xs text-gray-500 mb-3">World Chain</p>
          {balanceDisplay.kind === 'loading' ? (
            <p className="text-lg text-gray-500 tabular-nums">Cargando…</p>
          ) : balanceDisplay.kind === 'error' ? (
            <p className="text-lg font-medium text-gray-700">
              {balanceDisplay.message}
            </p>
          ) : (
            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0">
              <span className="text-3xl font-bold tracking-tight tabular-nums text-gray-900">
                {balanceDisplay.amount}
              </span>
              <span className="text-lg font-semibold text-gray-500">WLD</span>
            </div>
          )}
        </div>

        <div className="w-full max-w-md mx-auto">
          <Button
            size="lg"
            variant="primary"
            className="w-full text-base font-medium tracking-wide rounded-sm shadow"
            disabled={!addFundsUrl}
            onClick={openAddFunds}
          >
            Agregar fondos
          </Button>
          {!addFundsUrl ? (
            <p className="mt-2 text-center text-xs text-amber-800">
              Falta configurar NEXT_PUBLIC_APP_ID para abrir el flujo de depósito
              de World App.
            </p>
          ) : (
            <p className="mt-2 text-center text-xs text-gray-500">
              Se abre la mini app oficial de World para depositar WLD en tu
              billetera.
            </p>
          )}
        </div>
      </Page.Main>
    </>
  );
}
