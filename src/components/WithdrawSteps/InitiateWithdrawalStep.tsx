'use client';

import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import { useExchangeQuote } from '@/components/ExchangeRatesProvider';
import {
  calculateConversionFromQuote,
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
  const { quote, loading: quoteLoading, error: quoteError, refetch } =
    useExchangeQuote();
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [recipientName, setRecipientName] = useState('Destinatario SINPE');
  const [contactEmail, setContactEmail] = useState('');
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
    const storedEmail = sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL);

    if (!phone || !profileRaw) {
      router.replace('/withdraw/phone');
      return;
    }
    if (!storedEmail?.trim()) {
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
    setContactEmail(storedEmail.trim());
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
      setError('Faltan datos del destinatario. Volvé al retiro.');
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

  if (quoteLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-gray-500">Cargando tasa de cambio…</div>
      </div>
    );
  }

  if (!quote || quote.wldToCrc <= 0) {
    return (
      <div className="mx-auto flex min-h-[400px] w-full max-w-md flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-sm text-gray-700">
          {quoteError ?? 'No pudimos obtener la tasa WLD → colones.'}
        </p>
        <Button
          type="button"
          onClick={() => refetch()}
          size="lg"
          variant="primary"
          className="rounded-sm"
        >
          Reintentar
        </Button>
      </div>
    );
  }

  const amountNum = parseFloat(amountWldStr);
  const conv = calculateConversionFromQuote(quote, amountNum);

  return (
    <div className="mx-auto grid w-full max-w-md gap-8">
      <StepProgress currentStep={6} totalSteps={7} />

      <StepHeader
        title="Resumen del retiro"
        description="Revisá destino, correo y montos estimados; después enviás los WLD desde World App."
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
          <div className="mb-1 text-xs text-gray-500">Correo de contacto</div>
          <div className="break-all text-base text-gray-900">{contactEmail}</div>
        </div>

        <div className="border-t border-gray-200" />

        <div className="space-y-3">
          <div>
            <div className="mb-1 text-xs text-gray-500">
              Enviás en World App
            </div>
            <div className="text-xl font-semibold tabular-nums text-gray-900">
              {formatCurrency.WLD(amountNum)}
            </div>
          </div>

          <div className="space-y-2 border-t border-gray-100 pt-3 text-sm">
            <div className="flex items-baseline justify-between gap-3 tabular-nums text-gray-700">
              <span className="text-gray-500">Bruto aprox. en colones</span>
              <span>{formatCurrency.CRC(conv.crc)}</span>
            </div>
            <div className="flex items-baseline justify-between gap-3 tabular-nums text-gray-700">
              <span className="text-gray-500">Comisión estimada</span>
              <span>− {formatCurrency.CRC(conv.fee)}</span>
            </div>
            <div className="border-t border-gray-200 pt-2" />
            <div className="flex items-baseline justify-between gap-3 tabular-nums">
              <span className="font-medium text-gray-900">
                Recibirías aprox. (CRC)
              </span>
              <span className="text-lg font-semibold text-gray-900">
                {formatCurrency.CRC(conv.netCrc)}
              </span>
            </div>
          </div>

          <p className="text-[11px] leading-relaxed text-gray-400">
            Cifras orientativas según tipo de cambio y comisión configurados en
            la app. El monto final en colones lo define y liquida Ridivi al
            procesar tu retiro.
          </p>
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
            pending: 'Preparando retiro…',
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
            Se abrirá World App para que autorices el envío de WLD. Podés
            cancelar antes de confirmar; hasta entonces no se debita nada.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
