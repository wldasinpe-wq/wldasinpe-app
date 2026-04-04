'use client';
import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';
import { InfoBox } from './ui/InfoBox';
import {
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';

type SinpeProfile = {
  nombreCliente: string;
  identificacion: string;
  cuentaInterna: string;
};

function parseProfile(raw: string | null): SinpeProfile | null {
  if (!raw) return null;
  try {
    const o = JSON.parse(raw) as Partial<SinpeProfile>;
    if (
      typeof o.nombreCliente === 'string' &&
      typeof o.identificacion === 'string' &&
      typeof o.cuentaInterna === 'string'
    ) {
      return {
        nombreCliente: o.nombreCliente,
        identificacion: o.identificacion,
        cuentaInterna: o.cuentaInterna,
      };
    }
  } catch {
    /* ignore */
  }
  return null;
}

export const ConfirmStep = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [profile, setProfile] = useState<SinpeProfile | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const savedPhone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const savedProfile = parseProfile(
      sessionStorage.getItem(SINPE_SESSION_PROFILE)
    );

    if (!savedPhone || !savedProfile) {
      router.replace('/withdraw/phone');
      return;
    }

    setPhoneNumber(savedPhone);
    setProfile(savedProfile);
    setIsLoading(false);
  }, [router]);

  const handleContinue = () => {
    router.push('/withdraw/id');
  };

  if (isLoading || !profile) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="grid w-full gap-8 max-w-md">
      <StepProgress currentStep={2} totalSteps={4} />

      <StepHeader
        title="Confirmar cuenta destino"
        description="Verificá que los datos sean correctos antes de continuar"
        className="gap-4"
      />

      <div
        className="border border-gray-900 p-6 space-y-5"
        style={{ background: 'var(--white-ridivi)' }}
      >
        <div>
          <div className="text-xs text-gray-500 mb-1">Número de teléfono</div>
          <div className="text-xl font-semibold text-gray-900">
            {phoneNumber}
          </div>
        </div>

        <div className="border-t border-gray-200" />

        <div>
          <div className="text-xs text-gray-500 mb-1">Titular (SINPE Móvil)</div>
          <div className="text-lg font-medium text-gray-900">
            {profile.nombreCliente}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Identificación</div>
          <div className="text-base text-gray-900 break-all">
            {profile.identificacion}
          </div>
        </div>

        <div>
          <div className="text-xs text-gray-500 mb-1">Cuenta interna (IBAN)</div>
          <div className="text-sm text-gray-900 break-all font-mono">
            {profile.cuentaInterna}
          </div>
        </div>
      </div>

      <div className="px-2">
        <Button
          onClick={handleContinue}
          size="lg"
          variant="primary"
          className="w-full text-base font-medium tracking-wide rounded-sm shadow"
        >
          Confirmar y continuar
        </Button>
      </div>

      <InfoBox>
        <div className="text-sm text-gray-700 space-y-2">
          <p className="font-medium text-gray-900">Importante</p>
          <p>
            Estos datos provienen de SINPE Móvil. Si algo no coincide con tu
            cuenta, volvé atrás y corregí el número.
          </p>
        </div>
      </InfoBox>
    </div>
  );
};
