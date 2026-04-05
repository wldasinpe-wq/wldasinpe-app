'use client';

import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useSession } from 'next-auth/react';
import { useState, useEffect } from 'react';
import * as React from 'react';
import { parseUnits } from 'viem';
import {
  EXCHANGE_RATES,
  LIMITS,
  formatCurrency,
} from '@/constants/exchange';
import { wldWeiToKeypadAmount, wldWeiToNumber } from '@/lib/wld-onchain';
import {
  SINPE_SESSION_AMOUNT_WLD,
  SINPE_SESSION_CONTACT_EMAIL,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import { useWldBalance } from '@/components/WldBalanceDisplay';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';

const WLD_DECIMALS = 18 as const;

function tryParseAmountWei(amountStr: string): bigint | null {
  if (!amountStr || amountStr === '.') return null;
  try {
    return parseUnits(amountStr, WLD_DECIMALS);
  } catch {
    return null;
  }
}

export const AmountStep = () => {
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
  const [isProcessing, setIsProcessing] = useState(false);
  const amountDisplayRef = React.useRef<HTMLDivElement>(null);

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

  // Auto-scroll to show the last digits
  useEffect(() => {
    if (amountDisplayRef.current) {
      amountDisplayRef.current.scrollLeft = amountDisplayRef.current.scrollWidth;
    }
  }, [amountWLD]);

  const handleNumberClick = (num: string) => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    
    // Evitar múltiples puntos decimales
    if (num === '.' && amountWLD.includes('.')) {
      setIsProcessing(false);
      return;
    }
    
    // Limitar a 2 decimales
    if (amountWLD.includes('.')) {
      const [, decimals] = amountWLD.split('.');
      if (decimals && decimals.length >= 2) {
        setIsProcessing(false);
        return;
      }
    }
    
    setAmountWLD(prev => prev + num);
    setError('');
    
    // Debounce para evitar clicks múltiples
    setTimeout(() => {
      setIsProcessing(false);
    }, 150);
  };

  const handleBackspace = () => {
    if (isProcessing) return;
    
    setIsProcessing(true);
    setAmountWLD(prev => prev.slice(0, -1));
    setError('');
    
    setTimeout(() => {
      setIsProcessing(false);
    }, 150);
  };

  const handleMaxClick = () => {
    if (isProcessing || balanceWei === null) return;
    setAmountWLD(wldWeiToKeypadAmount(balanceWei));
    setError('');
  };

  const handleContinue = () => {
    if (!phoneNumber) {
      setError('Número de teléfono no encontrado');
      return;
    }

    const amount = parseFloat(amountWLD);

    if (isNaN(amount) || amount <= 0) {
      setError('Ingresá una cantidad válida');
      return;
    }
    if (amount < LIMITS.MIN_WLD) {
      setError(`Mínimo: ${LIMITS.MIN_WLD} WLD`);
      return;
    }
    const enteredWei = tryParseAmountWei(amountWLD);
    if (balanceWei === null || enteredWei === null) {
      setError('No se pudo validar el saldo');
      return;
    }
    if (enteredWei > balanceWei) {
      setError('Saldo insuficiente');
      return;
    }

    setError('');
    sessionStorage.setItem(SINPE_SESSION_AMOUNT_WLD, amountWLD.trim());
    router.push('/withdraw/id');
  };

  const amountCRC = parseFloat(amountWLD || '0') * EXCHANGE_RATES.WLD_TO_CRC;
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
        <StepProgress currentStep={4} totalSteps={7} />
        <StepHeader
          title="Monto a retirar"
          description="WLD a tu cuenta SINPE"
          compact
          className="px-0"
        />
      </div>

      <div className="flex min-h-0 flex-1 flex-col justify-center overflow-y-auto overscroll-contain px-3 py-4">
        <div className="mx-auto flex w-full max-w-xs flex-col items-center gap-5">
          <p className="max-w-full truncate text-center text-sm text-gray-600">
            A {recipientName}
          </p>

          <div className="flex w-full items-center justify-center gap-3 px-1">
            <div className="flex min-w-0 flex-1 items-center justify-center gap-2 overflow-hidden">
              <span
                className={`shrink-0 text-lg font-semibold ${isOverBalance ? 'text-red-600' : 'text-gray-800'}`}
              >
                WLD
              </span>
              <div
                ref={amountDisplayRef}
                className={`scrollbar-hide max-w-full overflow-x-auto whitespace-nowrap text-center text-6xl font-bold leading-none tabular-nums sm:text-7xl ${isOverBalance ? 'text-red-600' : 'text-gray-900'}`}
                style={{
                  fontSize:
                    amountWLD.length > 12
                      ? '2rem'
                      : amountWLD.length > 9
                        ? '2.5rem'
                        : amountWLD.length > 7
                          ? '3.125rem'
                          : undefined,
                  scrollbarWidth: 'none',
                  msOverflowStyle: 'none',
                }}
              >
                {amountWLD || '0'}
              </div>
            </div>

            <button
              type="button"
              onClick={handleMaxClick}
              disabled={
                isProcessing ||
                balanceWei === null ||
                balanceWei === BigInt(0)
              }
              className="shrink-0 rounded-lg px-3 py-1.5 text-xs font-semibold uppercase tracking-wide text-blue-600 transition-colors active:bg-blue-50 active:text-blue-700 disabled:opacity-50"
            >
              Máx
            </button>
          </div>

          <div className="flex flex-col items-center gap-2">
            <p
              className={`text-base tabular-nums ${isOverBalance ? 'text-red-600' : 'text-gray-700'}`}
            >
              ≈ {formatCurrency.CRC(amountCRC)}
              <span className="text-sm font-normal text-gray-400"> · aprox.</span>
            </p>
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
                        onClick={() => refetchBalance()}
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
            onMouseDown={() => handleNumberClick('1')}
            onTouchStart={() => handleNumberClick('1')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            1
          </button>
          <button
            onMouseDown={() => handleNumberClick('2')}
            onTouchStart={() => handleNumberClick('2')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            2
          </button>
          <button
            onMouseDown={() => handleNumberClick('3')}
            onTouchStart={() => handleNumberClick('3')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            3
          </button>
          
          {/* Row 2 */}
          <button
            onMouseDown={() => handleNumberClick('4')}
            onTouchStart={() => handleNumberClick('4')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            4
          </button>
          <button
            onMouseDown={() => handleNumberClick('5')}
            onTouchStart={() => handleNumberClick('5')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            5
          </button>
          <button
            onMouseDown={() => handleNumberClick('6')}
            onTouchStart={() => handleNumberClick('6')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            6
          </button>
          
          {/* Row 3 */}
          <button
            onMouseDown={() => handleNumberClick('7')}
            onTouchStart={() => handleNumberClick('7')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            7
          </button>
          <button
            onMouseDown={() => handleNumberClick('8')}
            onTouchStart={() => handleNumberClick('8')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            8
          </button>
          <button
            onMouseDown={() => handleNumberClick('9')}
            onTouchStart={() => handleNumberClick('9')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            9
          </button>
          
          {/* Row 4 */}
          <button
            onMouseDown={() => handleNumberClick('.')}
            onTouchStart={() => handleNumberClick('.')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            .
          </button>
          <button
            onMouseDown={() => handleNumberClick('0')}
            onTouchStart={() => handleNumberClick('0')}
            disabled={isProcessing}
            type="button"
            className={keypadBtn}
          >
            0
          </button>
          <button
            type="button"
            onMouseDown={handleBackspace}
            onTouchStart={handleBackspace}
            disabled={isProcessing}
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
