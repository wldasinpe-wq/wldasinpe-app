'use client';

import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  EXCHANGE_RATES,
  LIMITS,
  formatCurrency,
} from '@/constants/exchange';
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

export const InitiateWithdrawalStep = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('Destinatario SINPE');
  const [amountWldStr, setAmountWldStr] = useState('');
  const [isLoading, setIsLoading] = useState(true);
  const [error, setError] = useState('');
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);

  useEffect(() => {
    sessionStorage.removeItem(SINPE_SESSION_PAY_REFERENCE);

    const phone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const profileRaw = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    const idFront = sessionStorage.getItem(SINPE_SESSION_ID_FRONT);
    const idBack = sessionStorage.getItem(SINPE_SESSION_ID_BACK);
    const amountRaw = sessionStorage.getItem(SINPE_SESSION_AMOUNT_WLD);
    const contactEmail = sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL);

    if (!phone || !profileRaw) {
      router.replace('/withdraw/phone');
      return;
    }
    if (!contactEmail?.trim()) {
      router.replace('/withdraw/email');
      return;
    }
    if (!amountRaw?.trim()) {
      router.replace('/withdraw/amount');
      return;
    }

    const amount = parseFloat(amountRaw);
    if (Number.isNaN(amount) || amount < LIMITS.MIN_WLD) {
      router.replace('/withdraw/amount');
      return;
    }
    if (!idFront || !idBack) {
      router.replace('/withdraw/id');
      return;
    }

    setPhoneNumber(phone);
    setAmountWldStr(amountRaw.trim());
    try {
      const p = JSON.parse(profileRaw) as { nombreCliente?: string };
      if (p.nombreCliente) {
        setRecipientName(p.nombreCliente);
      }
    } catch {
      /* keep default */
    }
    setIsLoading(false);
  }, [router]);

  const handleCreateReference = async () => {
    const amount = parseFloat(amountWldStr);
    if (Number.isNaN(amount) || amount < LIMITS.MIN_WLD) {
      hapticError();
      setError('Monto inválido');
      return;
    }

    setError('');
    hapticPrimary();
    setButtonState('pending');

    const profileRaw = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    const idFront = sessionStorage.getItem(SINPE_SESSION_ID_FRONT);
    const idBack = sessionStorage.getItem(SINPE_SESSION_ID_BACK);
    let initiateBody: Record<string, string | number | boolean>;

    try {
      const profile = profileRaw
        ? (JSON.parse(profileRaw) as {
            nombreCliente?: string;
            identificacion?: string;
            cuentaInterna?: string;
          })
        : null;
      if (
        !profile?.nombreCliente ||
        !profile.identificacion ||
        !profile.cuentaInterna
      ) {
        throw new Error('missing profile');
      }
      const { firstName, lastName } = splitLegalName(profile.nombreCliente);
      const emailStored =
        sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL)?.trim() ?? '';
      initiateBody = {
        phoneNumber: phoneNumber.trim(),
        amountWLD: amount,
        firstName,
        lastName,
        idNumber: profile.identificacion,
        accountNumber: profile.cuentaInterna,
        idFrontSubmitted: Boolean(idFront),
        idBackSubmitted: Boolean(idBack),
        contactEmail: emailStored,
      };
    } catch {
      hapticError();
      setButtonState('failed');
      setError('Faltan datos del destinatario. Volvé al inicio del retiro.');
      setTimeout(() => setButtonState(undefined), 3000);
      return;
    }

    try {
      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(initiateBody),
      });

      const data = (await res.json().catch(() => ({}))) as {
        id?: string;
        error?: string;
      };

      if (!res.ok) {
        hapticError();
        setButtonState('failed');
        if (res.status === 401) {
          setError('Sesión expirada. Volvé a iniciar sesión e intentá de nuevo.');
        } else if (res.status === 400 && data.error) {
          setError(
            data.error.length > 160
              ? `${data.error.slice(0, 157)}…`
              : data.error
          );
        } else if (res.status >= 500) {
          setError(
            data.error?.trim() ||
              'El servicio tuvo un error. Intentá de nuevo en unos minutos o escribinos a info@ridivi.com.'
          );
        } else {
          setError(
            data.error?.trim() ||
              'No se pudo crear el retiro. Intentá de nuevo o escribinos a info@ridivi.com.'
          );
        }
        setTimeout(() => setButtonState(undefined), 3000);
        return;
      }

      if (!data.id) {
        hapticError();
        setButtonState('failed');
        setError('Respuesta inválida del servidor. Intentá de nuevo.');
        setTimeout(() => setButtonState(undefined), 3000);
        return;
      }

      sessionStorage.setItem(SINPE_SESSION_PAY_REFERENCE, data.id);
      hapticSuccess();
      setButtonState('success');
      setTimeout(() => {
        router.push('/withdraw/pay');
      }, 400);
    } catch {
      hapticError();
      setButtonState('failed');
      setError('Error de red. Verificá tu conexión e intentá de nuevo.');
      setTimeout(() => setButtonState(undefined), 3000);
    }
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-gray-500">Cargando…</div>
      </div>
    );
  }

  const amountNum = parseFloat(amountWldStr);
  const amountCrc = amountNum * EXCHANGE_RATES.WLD_TO_CRC;

  return (
    <div className="mx-auto grid w-full max-w-md gap-8">
      <StepProgress currentStep={6} totalSteps={7} />

      <StepHeader
        title="Resumen del retiro"
        description="Verificá los datos y creá la referencia para enviar tus WLD"
        className="gap-4"
      />

      <div
        className="space-y-5 border border-gray-900 p-6"
        style={{ background: 'var(--white-ridivi)' }}
      >
        <div>
          <div className="mb-1 text-xs text-gray-500">SINPE Móvil</div>
          <div className="text-xl font-semibold text-gray-900">
            {phoneNumber}
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div>
          <div className="mb-1 text-xs text-gray-500">Titular</div>
          <div className="text-lg font-medium text-gray-900">
            {recipientName}
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div>
          <div className="mb-1 text-xs text-gray-500">Monto</div>
          <div className="text-xl font-semibold tabular-nums text-gray-900">
            {formatCurrency.WLD(amountNum)}
          </div>
          <div className="mt-1 text-sm tabular-nums text-gray-600">
            ≈ {formatCurrency.CRC(amountCrc)}
            <span className="pl-1 text-xs font-normal text-gray-400">
              aprox.
            </span>
          </div>
        </div>
      </div>

      {error ? (
        <p className="px-2 text-center text-sm font-medium text-red-600">
          {error}
        </p>
      ) : null}

      <div className="px-2">
        <LiveFeedback
          label={{
            failed: 'No se pudo crear',
            pending: 'Creando referencia…',
            success: 'Listo',
          }}
          state={buttonState}
          className="w-full"
        >
          <Button
            onClick={() => void handleCreateReference()}
            disabled={buttonState === 'pending'}
            size="lg"
            variant="primary"
            className="w-full rounded-sm text-base font-medium tracking-wide shadow"
          >
            Confirmar y continuar
          </Button>
        </LiveFeedback>
      </div>

      <InfoBox>
        <div className="space-y-2 text-sm text-gray-700">
          <p className="font-medium text-gray-900">Siguiente paso</p>
          <p>
            Vas a firmar la transferencia de WLD en cadena con la referencia
            que generamos. Podés cancelar antes de aceptar en World App.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
