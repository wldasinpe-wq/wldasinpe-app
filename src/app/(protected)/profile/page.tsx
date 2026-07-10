'use client';

import { Page } from '@/components/PageLayout';
import {
  WithdrawalHistoryItem,
  type ProfileWithdrawalRow,
} from '@/components/WithdrawalHistoryItem';
import { WldBalancePill } from '@/components/WldBalanceDisplay';
import { MiniKit } from '@worldcoin/minikit-js';
import { Button, TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { useIsUserVerified } from '@worldcoin/minikit-react';
import { useSession } from 'next-auth/react';
import { hapticPrimary } from '@/lib/haptics';
import { useCallback, useEffect, useMemo, useState } from 'react';

function shortenAddress(addr: string): string {
  if (addr.length < 12) return addr;
  return `${addr.slice(0, 6)}…${addr.slice(-4)}`;
}

function ProfileAuthenticated({
  address,
  username,
  picture,
}: {
  address: string;
  username: string;
  picture: string;
}) {
  const { isUserVerified, isLoading: verifiedLoading } =
    useIsUserVerified(address);

  const [withdrawals, setWithdrawals] = useState<ProfileWithdrawalRow[] | null>(
    null,
  );
  const [withdrawalsError, setWithdrawalsError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    (async () => {
      try {
        const res = await fetch('/api/my-withdrawals', {
          credentials: 'same-origin',
          cache: 'no-store',
        });
        const data = (await res.json()) as {
          withdrawals?: ProfileWithdrawalRow[];
          error?: string;
        };
        if (cancelled) return;
        if (!res.ok) {
          setWithdrawals([]);
          setWithdrawalsError(
            res.status === 401
              ? 'Tenés que iniciar sesión para ver tus retiros.'
              : 'No se pudieron cargar los retiros.',
          );
          return;
        }
        setWithdrawalsError(null);
        setWithdrawals(data.withdrawals ?? []);
      } catch {
        if (!cancelled) {
          setWithdrawals([]);
          setWithdrawalsError('No se pudieron cargar los retiros.');
        }
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [address]);

  const openProfileCard = useCallback(() => {
    hapticPrimary();
    if (username) {
      MiniKit.showProfileCard(username, undefined);
    } else {
      MiniKit.showProfileCard(undefined, address);
    }
  }, [username, address]);

  const verifiedLabel = useMemo(() => {
    if (verifiedLoading) return 'Verificando nivel Orb…';
    if (isUserVerified === true) return 'Verificado con Orb';
    if (isUserVerified === false) return 'Sin verificación Orb';
    return null;
  }, [verifiedLoading, isUserVerified]);

  return (
    <>
      <Page.Header className="p-0">
        <TopBar title="Perfil" endAdornment={<WldBalancePill />} />
      </Page.Header>
      <Page.Main className="flex flex-col gap-6 px-6 py-8 pb-28">
        <div
          className="w-full max-w-md mx-auto rounded-2xl p-5 flex flex-col items-center gap-3 text-center shadow-sm"
          style={{ background: 'var(--white-ridivi)' }}
        >
          {picture ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={picture}
              alt=""
              className="h-20 w-20 rounded-full object-cover shadow-inner"
            />
          ) : (
            <div className="h-20 w-20 rounded-full bg-gray-200 flex items-center justify-center text-2xl text-gray-500">
              {(username || address).slice(0, 1).toUpperCase()}
            </div>
          )}
          <div>
            <p className="text-lg font-semibold text-gray-900">
              {username ? `@${username}` : 'Usuario de World App'}
            </p>
            <p className="mt-1 font-mono text-xs text-gray-600 break-all">
              {shortenAddress(address)}
            </p>
          </div>
          {verifiedLabel ? (
            <p className="text-sm text-gray-700">{verifiedLabel}</p>
          ) : null}

          <Button
            size="sm"
            variant="secondary"
            className="mt-1"
            onClick={openProfileCard}
          >
            Ver tarjeta de perfil en World App
          </Button>
        </div>

        <div
          className="w-full max-w-md mx-auto rounded-2xl p-5 space-y-3 shadow-sm"
          style={{ background: 'var(--white-ridivi)' }}
        >
          <p className="text-xs font-medium text-gray-500 uppercase tracking-wide">
            Tus retiros en esta app
          </p>
          <p className="text-xs text-gray-500 leading-relaxed">
            Información de referencia para consultas. Verificá en{' '}
            <a
              href="https://worldscan.org/"
              target="_blank"
              rel="noopener noreferrer"
              className="font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-800"
            >
              worldscan.org
            </a>{' '}
            o escribí a{' '}
            <a
              href="mailto:info@ridivi.com"
              className="font-medium text-blue-700 underline decoration-blue-700/40 underline-offset-2 hover:text-blue-800"
            >
              info@ridivi.com
            </a>{' '}
            con los datos que copiés de cada retiro.
          </p>
          {withdrawals === null ? (
            <p className="text-sm text-gray-600">Cargando…</p>
          ) : withdrawalsError ? (
            <p className="text-sm text-amber-900">{withdrawalsError}</p>
          ) : withdrawals.length === 0 ? (
            <p className="text-sm text-gray-600">
              Todavía no tenés retiros registrados con esta billetera.
            </p>
          ) : (
            <ul className="space-y-3">
              {withdrawals.map((w) => (
                <WithdrawalHistoryItem
                  key={w.id}
                  w={w}
                  walletAddress={address}
                />
              ))}
            </ul>
          )}
        </div>
      </Page.Main>
    </>
  );
}

export default function ProfilePage() {
  const { data: session, status: sessionStatus } = useSession();
  const address = session?.user?.walletAddress ?? '';
  const username = session?.user?.username ?? '';
  const picture = session?.user?.profilePictureUrl ?? '';

  if (sessionStatus === 'loading') {
    return (
      <>
        <Page.Header className="p-0">
          <TopBar title="Perfil" />
        </Page.Header>
        <Page.Main className="flex flex-col gap-6 px-6 py-8 pb-28">
          <p className="text-center text-sm text-gray-600">Cargando sesión…</p>
        </Page.Main>
      </>
    );
  }

  if (
    sessionStatus !== 'authenticated' ||
    !address ||
    !/^0x[a-fA-F0-9]{40}$/i.test(address)
  ) {
    return (
      <>
        <Page.Header className="p-0">
          <TopBar title="Perfil" />
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
    <ProfileAuthenticated
      address={address}
      username={username}
      picture={picture}
    />
  );
}
