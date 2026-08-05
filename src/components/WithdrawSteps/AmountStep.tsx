'use client';

import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect, useLayoutEffect } from 'react';
import * as React from 'react';
import { parseUnits } from 'viem';
import { useExchangeQuote } from '@/components/ExchangeRatesProvider';
import { LIMITS, formatCurrency } from '@/constants/exchange';
import { wldWeiToKeypadAmount, wldWeiToNumber } from '@/lib/wld-onchain';
import {
  SINPE_SESSION_AMOUNT_WLD,
  SINPE_SESSION_CONTACT_EMAIL,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import { useWldBalance } from '@/components/WldBalanceDisplay';
import {
  hapticError,
  hapticPrimary,
  hapticSelection,
  hapticSuccess,
} from '@/lib/haptics';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';

const WLD_DECIMALS = 18 as const;

/** Display-only: shrink type smoothly so long / “Máx” amounts stay on one line. */
const AMOUNT_FONT_MIN_PX = 13;
const AMOUNT_FONT_MAX_PX = 54;

function tryParseAmountWei(amountStr: string): bigint | null {
  if (!amountStr || amountStr === '.') return null;
  try {
    return parseUnits(amountStr, WLD_DECIMALS);
  } catch {
    return null;
  }
}

export const AmountStep = () => {
  const { quote, loading: quoteLoading, error: quoteError, refetch } =
    useExchangeQuote();
  const { status: sessionStatus } = useSession();
  const {
    wei: balanceWei,
    loadState: balanceStatus,
    errorKind: balanceErrorKind,
    refetch: refetchBalance,
  } = useWldBalance();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [amountWLD, setAmountWLD] = useState<string>('');
  const [error, setError] = useState<string>('');
  /** Short lock so rapid taps don’t double-enter; avoids disabling other controls (e.g. Máx). */
  const keyLockRef = React.useRef(false);
  const backspaceDelayRef = React.useRef<number | null>(null);
  const backspaceIntervalRef = React.useRef<number | null>(null);
  const amountOuterRef = React.useRef<HTMLDivElement>(null);
  const amountInnerRef = React.useRef<HTMLSpanElement>(null);
  const amountWLDRef = React.useRef(amountWLD);
  const [amountFontPx, setAmountFontPx] = useState(AMOUNT_FONT_MAX_PX);
  amountWLDRef.current = amountWLD;

  const [recipientName, setRecipientName] = useState('Destinatario SINPE');

  useEffect(() => {
    const savedPhone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const profileRaw = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    const contactEmail = sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL);
    if (!savedPhone || !profileRaw) {
      router.replace('/withdraw/phone');
      return;
    }
    if (!contactEmail?.trim()) {
      router.replace('/withdraw/email');
      return;
    }
    setPhoneNumber(savedPhone);
    try {
      const p = JSON.parse(profileRaw) as { nombreCliente?: string };
      if (p.nombreCliente) {
        setRecipientName(p.nombreCliente);
      }
    } catch {
      /* keep default */
    }
  }, [router]);

  useLayoutEffect(() => {
    const outer = amountOuterRef.current;
    const inner = amountInnerRef.current;
    if (!outer || !inner) return;

    const fitFont = () => {
      const available = outer.clientWidth;
      if (available < 8) return;

      let lo = AMOUNT_FONT_MIN_PX;
      let hi = AMOUNT_FONT_MAX_PX;
      let best = lo;

      while (lo <= hi) {
        const mid = Math.floor((lo + hi) / 2);
        inner.style.fontSize = `${mid}px`;
        const w = inner.scrollWidth;
        if (w <= available) {
          best = mid;
          lo = mid + 1;
        } else {
          hi = mid - 1;
        }
      }

      inner.style.fontSize = `${best}px`;
      setAmountFontPx(best);
    };

    fitFont();
    const ro = new ResizeObserver(fitFont);
    ro.observe(outer);
    return () => ro.disconnect();
  }, [amountWLD]);

  const stopBackspaceHold = React.useCallback(() => {
    if (backspaceDelayRef.current !== null) {
      clearTimeout(backspaceDelayRef.current);
      backspaceDelayRef.current = null;
    }
    if (backspaceIntervalRef.current !== null) {
      clearInterval(backspaceIntervalRef.current);
      backspaceIntervalRef.current = null;
    }
  }, []);

  React.useEffect(() => () => stopBackspaceHold(), [stopBackspaceHold]);

  const handleNumberClick = (num: string) => {
    if (keyLockRef.current) return;
    const prev = amountWLDRef.current;

    if (num === '.' && prev.includes('.')) return;
    if (prev.includes('.')) {
      const [, decimals] = prev.split('.');
      if (decimals && decimals.length >= 2) return;
    }

    const joined = prev + num;
    keyLockRef.current = true;
    hapticSelection();
    amountWLDRef.current = joined;
    setAmountWLD(joined);
    setError('');
    window.setTimeout(() => {
      keyLockRef.current = false;
    }, 110);
  };

  const handleBackspacePointerDown = (
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    if (e.pointerType === 'mouse' && e.button !== 0) return;
    e.preventDefault();
    const el = e.currentTarget;
    el.setPointerCapture(e.pointerId);

    stopBackspaceHold();
    if (amountWLDRef.current.length > 0) {
      hapticSelection();
    }
    setAmountWLD((prev) => {
      const next = prev.slice(0, -1);
      amountWLDRef.current = next;
      return next;
    });
    setError('');

    backspaceDelayRef.current = window.setTimeout(() => {
      backspaceIntervalRef.current = window.setInterval(() => {
        setAmountWLD((prev) => {
          if (prev.length === 0) {
            stopBackspaceHold();
            return prev;
          }
          const next = prev.slice(0, -1);
          amountWLDRef.current = next;
          if (next.length === 0) {
            stopBackspaceHold();
          }
          return next;
        });
      }, 68);
    }, 420);
  };

  const handleBackspacePointerEnd = (
    e: React.PointerEvent<HTMLButtonElement>,
  ) => {
    stopBackspaceHold();
    try {
      e.currentTarget.releasePointerCapture(e.pointerId);
    } catch {
      /* already released */
    }
  };

  const handleMaxClick = () => {
    if (balanceWei === null) return;
    hapticPrimary();
    const maxStr = wldWeiToKeypadAmount(balanceWei);
    amountWLDRef.current = maxStr;
    setAmountWLD(maxStr);
    setError('');
  };

  const handleContinue = () => {
    if (!phoneNumber) {
      hapticError();
      setError('Número de teléfono no encontrado');
      return;
    }

    const amount = parseFloat(amountWLD);

    if (isNaN(amount) || amount <= 0) {
      hapticError();
      setError('Ingresá una cantidad válida');
      return;
    }
    if (amount < LIMITS.MIN_WLD) {
      hapticError();
      setError(`Mínimo: ${LIMITS.MIN_WLD} WLD`);
      return;
    }
    const enteredWei = tryParseAmountWei(amountWLD);
    if (balanceWei === null || enteredWei === null) {
      hapticError();
      setError('No se pudo validar el saldo');
      return;
    }
    if (enteredWei > balanceWei) {
      hapticError();
      setError('Saldo insuficiente');
      return;
    }

    hapticSuccess();
    setError('');
    sessionStorage.setItem(SINPE_SESSION_AMOUNT_WLD, amountWLD.trim());
    router.push('/withdraw/review');
  };

  const wldToCrc = quote?.wldToCrc ?? 0;
  const amountCRC = parseFloat(amountWLD || '0') * wldToCrc;
  const amountWeiEntered = tryParseAmountWei(amountWLD);
  const minWei = parseUnits(String(LIMITS.MIN_WLD), WLD_DECIMALS);
  const isOverBalance =
    balanceWei !== null &&
    amountWeiEntered !== null &&
    amountWeiEntered > balanceWei;
  const canSubmit =
    balanceStatus === 'ready' &&
    balanceWei !== null &&
    balanceWei > BigInt(0) &&
    amountWeiEntered !== null &&
    amountWeiEntered >= minWei &&
    amountWeiEntered <= balanceWei &&
    !error &&
    !!phoneNumber;

  const keypadBtn =
    'h-12 flex items-center justify-center text-xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors';

  return (
    <div className="mx-auto flex h-full min-h-0 w-full max-w-md flex-col">
      <div className="shrink-0 space-y-4 px-1 pt-2">
        <StepProgress currentStep={4} totalSteps={6} />
        <StepHeader
          title="Monto a retirar"
          description="WLD a tu cuenta SINPE"
          compact
          className="px-0"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain px-3 py-4">
        <div className="mx-auto flex w-full max-w-sm flex-col items-center gap-5">
          <p className="max-w-full truncate text-center text-sm text-gray-600">
            A {recipientName}
          </p>

          <div className="flex min-h-13 w-full items-center justify-center gap-2 px-0.5 sm:gap-3">
            <span
              className={`shrink-0 self-center text-base font-semibold tabular-nums sm:text-lg ${isOverBalance ? 'text-red-600' : 'text-gray-800'}`}
            >
              WLD
            </span>
            <div
              ref={amountOuterRef}
              className="flex min-h-11 min-w-0 flex-1 items-center justify-center overflow-hidden"
            >
              <span
                ref={amountInnerRef}
                className={`inline-block max-w-none whitespace-nowrap text-center font-semibold tabular-nums leading-none tracking-tight ${isOverBalance ? 'text-red-600' : 'text-gray-900'}`}
                style={{ fontSize: amountFontPx }}
                translate="no"
              >
                {amountWLD || '0'}
              </span>
            </div>

            <button
              type="button"
              onClick={handleMaxClick}
              disabled={balanceWei === null || balanceWei === BigInt(0)}
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 transition-colors active:bg-blue-50 active:text-blue-700 disabled:opacity-50"
            >
              Máx
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p
              className={`text-base tabular-nums ${isOverBalance ? 'text-red-600' : 'text-gray-700'}`}
            >
              ≈{' '}
              {quoteLoading
                ? '…'
                : !quote || quote.wldToCrc <= 0
                  ? '—'
                  : formatCurrency.CRC(amountCRC)}
              <span className="text-sm font-normal text-gray-400"> · aprox.</span>
            </p>
            {!quoteLoading && (!quote || quote.wldToCrc <= 0) ? (
              <p className="text-center text-xs text-red-600">
                {quoteError ?? 'Tasa no disponible.'}{' '}
                <button
                  type="button"
                  onClick={() => refetch()}
                  className="font-semibold text-blue-600 underline"
                >
                  Reintentar
                </button>
              </p>
            ) : null}
            <p className="text-center text-xs leading-relaxed text-gray-500">
              {balanceStatus === 'loading' ? (
                <>Obteniendo saldo…</>
              ) : balanceStatus === 'ready' && balanceWei !== null ? (
                <>
                  Saldo {formatCurrency.WLD(wldWeiToNumber(balanceWei))} · mín.{' '}
                  {LIMITS.MIN_WLD} WLD
                  {balanceWei === BigInt(0) ? (
                    <span className="mt-1.5 block text-[11px] text-gray-400">
                      Tu saldo WLD en World Chain es 0. Cargá WLD en World App
                      para poder retirar.
                    </span>
                  ) : null}
                </>
              ) : sessionStatus !== 'authenticated' ||
                balanceErrorKind === 'no_wallet' ? (
                <>
                  No encontramos la billetera en la sesión. Cerrá sesión y
                  volvé a entrar con World App (Wallet Auth).
                </>
              ) : (
                <>
                  No pudimos consultar el saldo en World Chain.
                  {balanceStatus === 'error' &&
                  sessionStatus === 'authenticated' &&
                  balanceErrorKind === 'rpc' ? (
                    <span className="mt-2 block">
                      <button
                        type="button"
                        onClick={() => {
                          hapticSelection();
                          refetchBalance();
                        }}
                        className="text-xs font-semibold text-blue-600 underline decoration-blue-300 underline-offset-2 active:opacity-70"
                      >
                        Reintentar consulta de saldo
                      </button>
                    </span>
                  ) : null}
                </>
              )}
            </p>
          </div>

          {isOverBalance ? (
            <p className="text-center text-sm font-medium text-red-600">
              Saldo insuficiente
            </p>
          ) : null}

          {error ? (
            <p className="text-center text-sm font-medium text-red-600">
              {error}
            </p>
          ) : null}
        </div>
      </div>

      <div className="shrink-0 border-t border-gray-100 px-3 pb-2 pt-5">
        <div className="mx-auto mb-3 grid w-full max-w-sm grid-cols-3 gap-2">
          {/* Row 1 */}
          <button
            type="button"
            onPointerDown={() => handleNumberClick('1')}
            className={keypadBtn}
          >
            1
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('2')}
            className={keypadBtn}
          >
            2
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('3')}
            className={keypadBtn}
          >
            3
          </button>

          {/* Row 2 */}
          <button
            type="button"
            onPointerDown={() => handleNumberClick('4')}
            className={keypadBtn}
          >
            4
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('5')}
            className={keypadBtn}
          >
            5
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('6')}
            className={keypadBtn}
          >
            6
          </button>

          {/* Row 3 */}
          <button
            type="button"
            onPointerDown={() => handleNumberClick('7')}
            className={keypadBtn}
          >
            7
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('8')}
            className={keypadBtn}
          >
            8
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('9')}
            className={keypadBtn}
          >
            9
          </button>

          {/* Row 4 */}
          <button
            type="button"
            onPointerDown={() => handleNumberClick('.')}
            className={keypadBtn}
          >
            .
          </button>
          <button
            type="button"
            onPointerDown={() => handleNumberClick('0')}
            className={keypadBtn}
          >
            0
          </button>
          <button
            type="button"
            onPointerDown={handleBackspacePointerDown}
            onPointerUp={handleBackspacePointerEnd}
            onPointerCancel={handleBackspacePointerEnd}
            onLostPointerCapture={() => stopBackspaceHold()}
            className={keypadBtn}
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M21 4H8l-7 8 7 8h13a2 2 0 0 0 2-2V6a2 2 0 0 0-2-2z"/>
              <line x1="18" y1="9" x2="12" y2="15"/>
              <line x1="12" y1="9" x2="18" y2="15"/>
            </svg>
          </button>
        </div>

        {/* Action Buttons */}
        <div className="max-w-sm mx-auto w-full px-1">
          <Button
            onClick={handleContinue}
            disabled={!canSubmit}
            size="lg"
            variant="primary"
            className="w-full text-base font-medium tracking-wide rounded-sm shadow"
          >
            Continuar
          </Button>
        </div>
      </div>
    </div>
  );
};
