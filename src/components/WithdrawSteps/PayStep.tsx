'use client';

import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '@/constants/exchange';
import {
  SINPE_SESSION_AMOUNT_WLD,
  SINPE_SESSION_ID_BACK,
  SINPE_SESSION_ID_FRONT,
  SINPE_SESSION_PAY_REFERENCE,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import { TRANSACTION_PENDING_ERROR } from '@/lib/world-minikit-transaction';

const CHAIN_POLL_INTERVAL_MS = 2000;
const CHAIN_POLL_MAX_MS = 3 * 60 * 1000;
import { InfoBox } from './ui/InfoBox';
import { StepHeader } from './ui/StepHeader';
import { StepProgress } from './ui/StepProgress';

function clearWithdrawalSession() {
  sessionStorage.removeItem(SINPE_SESSION_PHONE);
  sessionStorage.removeItem(SINPE_SESSION_PROFILE);
  sessionStorage.removeItem(SINPE_SESSION_ID_FRONT);
  sessionStorage.removeItem(SINPE_SESSION_ID_BACK);
  sessionStorage.removeItem(SINPE_SESSION_AMOUNT_WLD);
  sessionStorage.removeItem(SINPE_SESSION_PAY_REFERENCE);
}

export const PayStep = () => {
  const router = useRouter();
  const [payReference, setPayReference] = useState<string | null>(null);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amountWldStr, setAmountWldStr] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);
  const [payProof, setPayProof] = useState<{
    referenceId: string;
    transactionId: string;
  } | null>(null);

  useEffect(() => {
    const ref = sessionStorage.getItem(SINPE_SESSION_PAY_REFERENCE);
    const phone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const amount = sessionStorage.getItem(SINPE_SESSION_AMOUNT_WLD);

    if (!ref || !phone || !amount?.trim()) {
      router.replace('/withdraw/review');
      return;
    }

    setPayReference(ref);
    setPhoneNumber(phone);
    setAmountWldStr(amount.trim());
    setIsLoading(false);
  }, [router]);

  const postCompleteWithdrawal = useCallback(
    async (referenceId: string, transactionId: string) => {
      const idFrontDataUrl =
        sessionStorage.getItem(SINPE_SESSION_ID_FRONT) ?? '';
      const idBackDataUrl =
        sessionStorage.getItem(SINPE_SESSION_ID_BACK) ?? '';
      return fetch('/api/complete-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId,
          transactionId,
          txHash: null,
          idFrontDataUrl,
          idBackDataUrl,
        }),
      });
    },
    []
  );

  /** Calls complete-withdrawal until World reports `mined` (or error / timeout). */
  const finalizeAfterChainConfirmation = useCallback(
    async (referenceId: string, transactionId: string) => {
      const started = Date.now();
      for (;;) {
        const res = await postCompleteWithdrawal(referenceId, transactionId);
        if (res.ok) {
          return res;
        }
        let payload: { error?: string } = {};
        try {
          payload = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        if (
          res.status === 409 &&
          payload.error === TRANSACTION_PENDING_ERROR
        ) {
          if (Date.now() - started > CHAIN_POLL_MAX_MS) {
            return new Response(
              JSON.stringify({ error: 'confirmation_timeout' }),
              {
                status: 408,
                headers: { 'Content-Type': 'application/json' },
              }
            );
          }
          await new Promise((r) => setTimeout(r, CHAIN_POLL_INTERVAL_MS));
          continue;
        }
        return new Response(JSON.stringify(payload), {
          status: res.status,
          headers: { 'Content-Type': 'application/json' },
        });
      }
    },
    [postCompleteWithdrawal]
  );

  const handlePay = async () => {
    if (!payReference) return;

    const amount = parseFloat(amountWldStr);
    if (Number.isNaN(amount) || amount <= 0) {
      setError('Monto inválido');
      return;
    }

    const RECIPIENT_ADDRESS =
      process.env.NEXT_PUBLIC_RIDIVI_WALLET_ADDRESS ||
      '0xce58b0A297714367b4dF592f3Aba82dA4e690b3a';

    setError('');
    setPayProof(null);
    setButtonState('pending');

    try {
      const result = await MiniKit.commandsAsync.pay({
        reference: payReference,
        to: RECIPIENT_ADDRESS,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(amount, Tokens.WLD).toString(),
          },
        ],
        description: `Retiro SINPE: ${phoneNumber} - ${amountWldStr} WLD`,
      });

      if (result.finalPayload.status === 'success') {
        const p = result.finalPayload;
        const completeRes = await finalizeAfterChainConfirmation(
          p.reference,
          p.transaction_id
        );
        if (!completeRes.ok) {
          setPayProof({
            referenceId: p.reference,
            transactionId: p.transaction_id,
          });
          setButtonState('failed');
          if (completeRes.status === 408) {
            setError(
              'La red tardó demasiado en confirmar. Tocá Reintentar para seguir esperando el aviso a Ridivi.'
            );
          } else {
            setError(
              'La transferencia se envió, pero no pudimos registrar el retiro ni enviar el aviso. Tocá Reintentar o contactá soporte con la referencia.'
            );
          }
          setTimeout(() => setButtonState(undefined), 4000);
          return;
        }

        setButtonState('success');
        clearWithdrawalSession();
        setTimeout(() => {
          router.push('/home');
        }, 2000);
      } else {
        setButtonState('failed');
        setError('Transferencia cancelada');
        setTimeout(() => setButtonState(undefined), 3000);
      }
    } catch (err) {
      console.error('Pay error:', err);
      setButtonState('failed');
      setError('No se pudo completar el envío');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  };

  const handleRetryNotify = async () => {
    if (!payProof) return;
    setError('');
    setButtonState('pending');
    try {
      const completeRes = await finalizeAfterChainConfirmation(
        payProof.referenceId,
        payProof.transactionId
      );
      if (!completeRes.ok) {
        setButtonState('failed');
        setError(
          completeRes.status === 408
            ? 'Seguimos esperando confirmación en la cadena. Reintentá en unos segundos.'
            : 'Seguimos sin poder completar el aviso. Contactá soporte.'
        );
        setTimeout(() => setButtonState(undefined), 4000);
        return;
      }
      setButtonState('success');
      setPayProof(null);
      clearWithdrawalSession();
      setTimeout(() => {
        router.push('/home');
      }, 2000);
    } catch {
      setButtonState('failed');
      setError('Error de red al reintentar.');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  };

  if (isLoading || !payReference) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-gray-500">Cargando…</div>
      </div>
    );
  }

  const amountNum = parseFloat(amountWldStr);

  return (
    <div className="mx-auto grid w-full max-w-md gap-8">
      <StepProgress currentStep={6} totalSteps={6} />

      <StepHeader
        title="Enviar WLD"
        description="Confirmá la transferencia en World App para completar el retiro"
        className="gap-4"
      />

      <div
        className="space-y-4 border border-gray-900 p-6"
        style={{ background: 'var(--white-ridivi)' }}
      >
        <div>
          <div className="mb-1 text-xs text-gray-500">Monto a enviar</div>
          <div className="text-2xl font-semibold tabular-nums text-gray-900">
            {formatCurrency.WLD(amountNum)}
          </div>
        </div>
        <div>
          <div className="mb-1 text-xs text-gray-500">Destino SINPE</div>
          <div className="text-lg font-medium text-gray-900">{phoneNumber}</div>
        </div>
      </div>

      {error ? (
        <p className="px-2 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {payProof ? (
        <div className="px-2 text-center">
          <p className="mb-2 font-mono text-xs text-gray-600">
            Ref: {payProof.referenceId}
          </p>
          <Button
            type="button"
            onClick={() => void handleRetryNotify()}
            disabled={buttonState === 'pending'}
            size="sm"
            variant="secondary"
            className="w-full rounded-sm"
          >
            Reintentar registro y aviso
          </Button>
        </div>
      ) : null}

      <div className="px-2">
        <LiveFeedback
          label={{
            failed: 'Envío fallido',
            pending: 'Confirmando en la cadena…',
            success: 'Retiro exitoso',
          }}
          state={buttonState}
          className="w-full"
        >
          <Button
            onClick={() => void handlePay()}
            disabled={buttonState === 'pending' || payProof !== null}
            size="lg"
            variant="primary"
            className="w-full rounded-sm text-base font-medium tracking-wide shadow"
          >
            Enviar WLD
          </Button>
        </LiveFeedback>
      </div>

      <InfoBox>
        <div className="space-y-2 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Seguridad</p>
          <p>
            Solo se debita el monto indicado. La referencia vincula tu retiro
            con el pago en cadena para el proveedor.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
