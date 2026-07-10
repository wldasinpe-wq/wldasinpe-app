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
import { splitLegalName } from '@/lib/split-legal-name';
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
  switch (code) {
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
  if (code === 'draft_withdrawal_required') {
    return 'Faltan datos del retiro. Volvé al resumen y confirmá de nuevo.';
  }
  if (status === 400 && code) {
    return 'No pudimos validar el retiro. Volvé atrás o escribinos a info@ridivi.com.';
  }
  return 'La transferencia se envió, pero no pudimos registrar el retiro ni enviar el aviso. Tocá Reintentar o escribinos a info@ridivi.com.';
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
      const phoneNumber = sessionStorage.getItem(SINPE_SESSION_PHONE) ?? '';
      const amountRaw = sessionStorage.getItem(SINPE_SESSION_AMOUNT_WLD) ?? '';
      const contactEmail =
        sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL) ?? '';
      const profileRaw = sessionStorage.getItem(SINPE_SESSION_PROFILE);

      let firstName = '';
      let lastName = '';
      let idNumber = '';

      try {
        const profile = profileRaw
          ? (JSON.parse(profileRaw) as {
              nombreCliente?: string;
              identificacion?: string;
            })
          : null;
        if (profile?.nombreCliente) {
          const split = splitLegalName(profile.nombreCliente);
          firstName = split.firstName;
          lastName = split.lastName;
        }
        idNumber = profile?.identificacion ?? '';
      } catch {
        /* ignore */
      }

      return fetch('/api/complete-withdrawal', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          referenceId,
          transactionId,
          idFrontDataUrl,
          idBackDataUrl,
          phoneNumber,
          amountWLD: parseFloat(amountRaw),
          firstName,
          lastName,
          idNumber,
          contactEmail: contactEmail.trim() || null,
          idFrontSubmitted: Boolean(idFrontDataUrl),
          idBackSubmitted: Boolean(idBackDataUrl),
        }),
      });
    },
    []
  );

  const completeWithdrawal = useCallback(
    async (
      referenceId: string,
      transactionId: string
    ): Promise<FinalizeWithdrawalResult> => {
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
      return {
        ok: false,
        status: res.status,
        error: payload.error,
      };
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
        const completeRes = await completeWithdrawal(
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
      const completeRes = await completeWithdrawal(
        payProof.referenceId,
        payProof.transactionId
      );
      if (!completeRes.ok) {
        hapticError();
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
          SINPE. El comprobante en World App incluye el id de pago que Ridivi
          usa para conciliar.
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
            pending: 'Registrando retiro…',
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
            soporte, Ridivi usa el id de pago de World App o la referencia de
            este retiro.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
