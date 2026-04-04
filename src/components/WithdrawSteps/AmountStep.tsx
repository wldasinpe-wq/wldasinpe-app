'use client';

import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useState, useEffect } from 'react';
import * as React from 'react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import {
  EXCHANGE_RATES,
  LIMITS,
  formatCurrency,
} from '@/constants/exchange';
import {
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';

export const AmountStep = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState<string | null>(null);
  const [amountWLD, setAmountWLD] = useState<string>('');
  const [error, setError] = useState<string>('');
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);
  const [isProcessing, setIsProcessing] = useState(false);
  const amountDisplayRef = React.useRef<HTMLDivElement>(null);

  const userBalance = 500; // TODO: Replace with actual user's WLD balance
  const [recipientName, setRecipientName] = useState('Destinatario SINPE');

  useEffect(() => {
    const savedPhone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const profileRaw = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    if (!savedPhone || !profileRaw) {
      router.replace('/withdraw/phone');
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
    if (buttonState === 'pending' || isProcessing) return;
    
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
    if (buttonState === 'pending' || isProcessing) return;
    
    setIsProcessing(true);
    setAmountWLD(prev => prev.slice(0, -1));
    setError('');
    
    setTimeout(() => {
      setIsProcessing(false);
    }, 150);
  };

  const handleMaxClick = () => {
    if (buttonState === 'pending') return;
    setAmountWLD(userBalance.toString());
    setError('');
  };

  const onClickWithdraw = async () => {
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
    if (amount > userBalance) {
      setError('Saldo insuficiente');
      return;
    }

    setError('');
    setButtonState('pending');

    const RECIPIENT_ADDRESS =
      process.env.NEXT_PUBLIC_RIDIVI_WALLET_ADDRESS ||
      '0xce58b0A297714367b4dF592f3Aba82dA4e690b3a';

    try {
      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          amountWLD: amount,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al crear el pago');
      }

      const { id } = await res.json();

      let recipientDisplayName = '';
      try {
        const recipientInfo = await MiniKit.getUserByAddress(RECIPIENT_ADDRESS);
        if (recipientInfo?.username) {
          recipientDisplayName = recipientInfo.username;
        } else {
          recipientDisplayName = `${RECIPIENT_ADDRESS.slice(0, 6)}...${RECIPIENT_ADDRESS.slice(-4)}`;
        }
      } catch (err) {
        recipientDisplayName = `${RECIPIENT_ADDRESS.slice(0, 6)}...${RECIPIENT_ADDRESS.slice(-4)}`;
      }

      const result = await MiniKit.commandsAsync.pay({
        reference: id,
        to: RECIPIENT_ADDRESS,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(amount, Tokens.WLD).toString(),
          },
        ],
        description: `Retiro SINPE: ${phoneNumber} - ${amountWLD} WLD`,
      });

      if (result.finalPayload.status === 'success') {
        setButtonState('success');
        sessionStorage.removeItem(SINPE_SESSION_PHONE);
        sessionStorage.removeItem(SINPE_SESSION_PROFILE);
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      } else {
        setButtonState('failed');
        setError('Retiro cancelado');
        setTimeout(() => {
          setButtonState(undefined);
        }, 3000);
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setButtonState('failed');
      setError('Error al procesar el retiro');
      setTimeout(() => {
        setButtonState(undefined);
      }, 3000);
    }
  };

  const amountCRC = parseFloat(amountWLD || '0') * EXCHANGE_RATES.WLD_TO_CRC;
  const amountFloat = parseFloat(amountWLD || '0');
  const isOverBalance = amountFloat > userBalance;
  const canSubmit =
    amountFloat >= LIMITS.MIN_WLD &&
    amountFloat <= userBalance &&
    !error &&
    phoneNumber;

  return (
    <div className="flex flex-col justify-between h-full w-full max-w-md mx-auto">
      <div className="grid gap-4 pb-4">
        <StepProgress currentStep={3} />
        <StepHeader
          title="Monto a retirar"
          description="Ingresá cuánto WLD querés retirar a tu cuenta SINPE"
          className="gap-2"
        />
      </div>

      {/* Header Section */}
      <div className="flex flex-col items-center px-4 py-2 gap-2.5 shrink-0">
        <p className="text-xs text-gray-600">{recipientName}</p>
        
        <div className="flex items-center justify-center gap-2 w-full px-2">
          <div className="flex justify-center items-center gap-1.5 min-w-0 flex-1 overflow-hidden">
            <span className={`font-medium shrink-0 ${isOverBalance ? 'text-red-600' : 'text-black'}`}>WLD</span>
            <div 
              ref={amountDisplayRef}
              className={`text-5xl font-bold text-center overflow-x-auto whitespace-nowrap scrollbar-hide ${isOverBalance ? 'text-red-600' : 'text-gray-900'}`}
              style={{ 
                fontSize: amountWLD.length > 10 ? '2.5rem' : amountWLD.length > 7 ? '3rem' : '3rem',
                scrollbarWidth: 'none',
                msOverflowStyle: 'none'
              }}
            >
              {amountWLD || '0'}
            </div>
          </div>
          
          <button
            onClick={handleMaxClick}
            disabled={buttonState === 'pending'}
            className="px-2 py-1 text-xs font-medium text-blue-600 active:text-blue-700 transition-colors uppercase tracking-wide disabled:opacity-50 shrink-0"
          >
            MAX
          </button>
        </div>
        
        <div className={`text-sm ${isOverBalance ? 'text-red-600' : 'text-gray-600'}`}>
          {formatCurrency.CRC(amountCRC)}
        </div>
        {isOverBalance && (
          <p className="text-xs text-red-600 font-medium">Saldo insuficiente</p>
        )}
        
        <div className="text-center">
          <p className="text-xs text-gray-500">
            Mínimo: {LIMITS.MIN_WLD} WLD
          </p>
          <p className="text-xs text-gray-400 mt-1">
            El monto final en CRC es aproximado
          </p>
        </div>
        
        {error && (
          <p className="text-xs text-red-600 font-medium">{error}</p>
        )}
      </div>

      {/* Numpad */}
      <div className="flex-1 flex flex-col justify-end px-3 pb-3 min-h-0">
        <div className="grid grid-cols-3 gap-1.5 mb-3 max-w-sm mx-auto w-full">
          {/* Row 1 */}
          <button
            onMouseDown={() => handleNumberClick('1')}
            onTouchStart={() => handleNumberClick('1')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            1
          </button>
          <button
            onMouseDown={() => handleNumberClick('2')}
            onTouchStart={() => handleNumberClick('2')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            2
          </button>
          <button
            onMouseDown={() => handleNumberClick('3')}
            onTouchStart={() => handleNumberClick('3')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            3
          </button>
          
          {/* Row 2 */}
          <button
            onMouseDown={() => handleNumberClick('4')}
            onTouchStart={() => handleNumberClick('4')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            4
          </button>
          <button
            onMouseDown={() => handleNumberClick('5')}
            onTouchStart={() => handleNumberClick('5')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            5
          </button>
          <button
            onMouseDown={() => handleNumberClick('6')}
            onTouchStart={() => handleNumberClick('6')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            6
          </button>
          
          {/* Row 3 */}
          <button
            onMouseDown={() => handleNumberClick('7')}
            onTouchStart={() => handleNumberClick('7')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            7
          </button>
          <button
            onMouseDown={() => handleNumberClick('8')}
            onTouchStart={() => handleNumberClick('8')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            8
          </button>
          <button
            onMouseDown={() => handleNumberClick('9')}
            onTouchStart={() => handleNumberClick('9')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            9
          </button>
          
          {/* Row 4 */}
          <button
            onMouseDown={() => handleNumberClick('.')}
            onTouchStart={() => handleNumberClick('.')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            .
          </button>
          <button
            onMouseDown={() => handleNumberClick('0')}
            onTouchStart={() => handleNumberClick('0')}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-2xl font-light text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
          >
            0
          </button>
          <button
            onMouseDown={handleBackspace}
            onTouchStart={handleBackspace}
            disabled={buttonState === 'pending'}
            className="h-14 flex items-center justify-center text-xl text-blue-600 hover:bg-blue-50 active:bg-blue-100 touch-manipulation select-none disabled:opacity-50 rounded-lg transition-colors"
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
          <LiveFeedback
            label={{
              failed: 'Retiro fallido',
              pending: 'Procesando',
              success: 'Retiro exitoso',
            }}
            state={buttonState}
            className="w-full"
          >
            <Button
              onClick={onClickWithdraw}
              disabled={!canSubmit || buttonState === 'pending'}
              size="lg"
              variant="primary"
              className="w-full text-base font-medium tracking-wide rounded-sm shadow"
            >
              Continuar
            </Button>
          </LiveFeedback>
        </div>
      </div>
    </div>
  );
};
