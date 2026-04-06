'use client';

import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useState } from 'react';
import { formatCurrency } from '@/constants/exchange';
import {
  SINPE_SESSION_AMOUNT_WLD,
  SINPE_SESSION_CONTACT_EMAIL,
  SINPE_SESSION_ID_BACK,
  SINPE_SESSION_ID_FRONT,
  SINPE_SESSION_PAY_REFERENCE,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import {
  hapticError,
  hapticPrimary,
  hapticSuccess,
} from '@/lib/haptics';
import {
  TRANSACTION_NOT_READY_ERROR,
  TRANSACTION_PENDING_ERROR,
} from '@/lib/world-minikit-transaction';

const CHAIN_POLL_INTERVAL_MS = 2000;
/** World docs: on-chain confirmation can take a few minutes. */
const CHAIN_POLL_MAX_MS = 5 * 60 * 1000;
import { InfoBox } from './ui/InfoBox';
import { StepHeader } from './ui/StepHeader';
import { StepProgress } from './ui/StepProgress';

type FinalizeWithdrawalResult =
  | { ok: true }
  | { ok: false; status: number; error?: string };

/** Maps `/api/complete-withdrawal` errors to Spanish copy (no internal ids shown to users). */
function userMessageForCompleteWithdrawalFailure(
  status: number,
  errorCode?: string
): string {
  const code = errorCode?.trim() ?? '';
  if (status === 408 || code === 'confirmation_timeout') {
    return 'La red tardó demasiado en confirmar. Tocá Reintentar para seguir esperando el aviso a Ridivi.';
  }
  switch (code) {
    case 'reference_mismatch':
      return 'El pago no coincide con este retiro. Si sigue pasando, escribinos a info@ridivi.com.';
    case 'on_chain_transaction_failed':
      return 'La transacción en cadena falló. Si ves un débito en World App, escribinos a info@ridivi.com con el detalle que muestre la app.';
    case 'transaction_not_ready':
      return 'La red aún no terminó de confirmar el pago. Tocá Reintentar en unos segundos.';
    case 'transaction_not_found':
      return 'No encontramos este pago en World todavía. Tocá Reintentar; si no cambia, escribinos a info@ridivi.com.';
    case 'transaction_lookup_failed':
      return 'No pudimos consultar el estado del pago con World. Reintentá en un momento o escribinos a info@ridivi.com.';
    case 'invalid_withdrawal_status':
      return 'Este retiro no se puede completar desde acá (estado inválido). Escribinos a info@ridivi.com.';
    case 'Withdrawal not found':
      return 'No encontramos este retiro. Iniciá un retiro nuevo o escribinos a info@ridivi.com.';
    case 'Forbidden':
      return 'Esta sesión no coincide con la billetera del retiro. Cerrá sesión y volvé a entrar con World App.';
    case 'Unauthorized':
      return 'Sesión expirada. Volvé a iniciar sesión e intentá de nuevo.';
    case 'server_misconfigured':
    case 'Internal server error':
      return 'Hubo un error en el servidor. Reintentá en unos minutos o escribinos a info@ridivi.com.';
    default:
      break;
  }
  if (code === 'Failed to send compliance email') {
    return 'El pago se confirmó, pero no pudimos enviar el aviso. Tocá Reintentar o escribinos a info@ridivi.com.';
  }
  if (
    code.includes('idFrontDataUrl') ||
    code.includes('ID image') ||
    code.includes('Invalid or oversized')
  ) {
    return 'Faltan o no son válidas las fotos del documento. Volvé al paso de identificación y subilas de nuevo.';
  }
  if (code === 'referenceId and transactionId are required') {
    return 'Faltan datos del pago. Volvé a firmar la transferencia en World App.';
  }
  if (status === 400 && code) {
    return 'No pudimos validar el retiro. Volvé atrás o escribinos a info@ridivi.com.';
  }
  return 'La transferencia se envió, pero no pudimos registrar el retiro ni enviar el aviso. Tocá Reintentar o escribinos a info@ridivi.com.';
}

function retryMessageForCompleteWithdrawalFailure(
  status: number,
  errorCode?: string
): string {
  const code = errorCode?.trim() ?? '';
  if (status === 408 || code === 'confirmation_timeout') {
    return 'Seguimos esperando confirmación en la cadena. Reintentá en unos segundos.';
  }
  return userMessageForCompleteWithdrawalFailure(status, errorCode);
}

function clearWithdrawalSession() {
  sessionStorage.removeItem(SINPE_SESSION_PHONE);
  sessionStorage.removeItem(SINPE_SESSION_PROFILE);
  sessionStorage.removeItem(SINPE_SESSION_CONTACT_EMAIL);
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
    async (
      referenceId: string,
      transactionId: string
    ): Promise<FinalizeWithdrawalResult> => {
      const started = Date.now();
      for (;;) {
        const res = await postCompleteWithdrawal(referenceId, transactionId);
        if (res.ok) {
          return { ok: true };
        }
        let payload: { error?: string } = {};
        try {
          payload = (await res.json()) as { error?: string };
        } catch {
          /* ignore */
        }
        const pollAgain =
          (res.status === 409 &&
            (payload.error === TRANSACTION_PENDING_ERROR ||
              payload.error === TRANSACTION_NOT_READY_ERROR)) ||
          (res.status === 502 &&
            payload.error === TRANSACTION_NOT_READY_ERROR);

        if (pollAgain) {
          if (Date.now() - started > CHAIN_POLL_MAX_MS) {
            return {
              ok: false,
              status: 408,
              error: 'confirmation_timeout',
            };
          }
          await new Promise((r) => setTimeout(r, CHAIN_POLL_INTERVAL_MS));
          continue;
        }
        return {
          ok: false,
          status: res.status,
          error: payload.error,
        };
      }
    },
    [postCompleteWithdrawal]
  );

  const handlePay = async () => {
    if (!payReference) return;

    const amount = parseFloat(amountWldStr);
    if (Number.isNaN(amount) || amount <= 0) {
      hapticError();
      setError('Monto inválido');
      return;
    }

    const RECIPIENT_ADDRESS =
      process.env.NEXT_PUBLIC_RIDIVI_WALLET_ADDRESS ||
      '0xce58b0A297714367b4dF592f3Aba82dA4e690b3a';

    setError('');
    setPayProof(null);
    hapticPrimary();
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
          hapticError();
          setPayProof({
            referenceId: p.reference,
            transactionId: p.transaction_id,
          });
          setButtonState('failed');
          setError(
            userMessageForCompleteWithdrawalFailure(
              completeRes.status,
              completeRes.error
            )
          );
          setTimeout(() => setButtonState(undefined), 4000);
          return;
        }

        hapticSuccess();
        setButtonState('success');
        clearWithdrawalSession();
        setTimeout(() => {
          router.push('/home?retiro=completado');
        }, 2000);
      } else {
        hapticError();
        setButtonState('failed');
        setError('Transferencia cancelada');
        setTimeout(() => setButtonState(undefined), 3000);
      }
    } catch (err) {
      console.error('Pay error:', err);
      hapticError();
      setButtonState('failed');
      setError('No se pudo completar el envío');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  };

  const handleRetryNotify = async () => {
    if (!payProof) return;
    hapticPrimary();
    setError('');
    setButtonState('pending');
    try {
      const completeRes = await finalizeAfterChainConfirmation(
        payProof.referenceId,
        payProof.transactionId
      );
      if (!completeRes.ok) {
        hapticError();
        setButtonState('failed');
        setError(
          retryMessageForCompleteWithdrawalFailure(
            completeRes.status,
            completeRes.error
          )
        );
        setTimeout(() => setButtonState(undefined), 4000);
        return;
      }
      hapticSuccess();
      setButtonState('success');
      setPayProof(null);
      clearWithdrawalSession();
      setTimeout(() => {
        router.push('/home?retiro=completado');
      }, 2000);
    } catch {
      hapticError();
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
      <StepProgress currentStep={7} totalSteps={7} />

      <StepHeader
        title="Enviar WLD"
        description="Solo falta autorizar el débito en World App. El colones estimado lo viste en el resumen."
        className="gap-4"
      />

      <div
        className="space-y-3 border border-gray-900 p-6"
        style={{ background: 'var(--white-ridivi)' }}
      >
        <div>
          <div className="mb-1 text-xs text-gray-500">Debitarás</div>
          <div className="text-2xl font-semibold tabular-nums text-gray-900">
            {formatCurrency.WLD(amountNum)}
          </div>
        </div>
        <p className="text-xs leading-relaxed text-gray-500">
          Va a la billetera de Ridivi en World Chain para completar tu retiro
          SINPE. El hash de la transacción queda en World App cuando se
          confirme.
        </p>
      </div>

      {error ? (
        <p className="px-2 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      {payProof ? (
        <div className="space-y-2 px-2 text-center">
          <p className="text-xs leading-relaxed text-gray-600">
            Si ya firmaste el envío en World App, podés reintentar para
            registrar el retiro y el aviso a Ridivi.
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
          <p className="font-medium text-gray-900">Importante</p>
          <p>
            Revisá el monto en el modal de World App antes de confirmar. Para
            soporte, Ridivi usa el comprobante o el hash que veas en la app
            cuando la red confirme — no hace falta ningún otro código de acá.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
