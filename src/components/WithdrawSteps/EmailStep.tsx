'use client';

import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { useRouter } from 'next/navigation';
import { useEffect, useState } from 'react';
import {
  SINPE_SESSION_CONTACT_EMAIL,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import {
  isValidContactEmail,
  normalizeContactEmail,
} from '@/lib/is-valid-contact-email';
import { InfoBox } from './ui/InfoBox';
import { StepHeader } from './ui/StepHeader';
import { StepProgress } from './ui/StepProgress';

export const EmailStep = () => {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const phone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const profile = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    if (!phone || !profile) {
      router.replace('/withdraw/phone');
      return;
    }
    const saved = sessionStorage.getItem(SINPE_SESSION_CONTACT_EMAIL);
    if (saved) {
      setEmail(saved);
    }
    setIsLoading(false);
  }, [router]);

  const canContinue = isValidContactEmail(email);

  const handleContinue = () => {
    const normalized = normalizeContactEmail(email);
    if (!normalized) {
      setError('Ingresá tu correo electrónico');
      return;
    }
    if (!isValidContactEmail(normalized)) {
      setError('Correo electrónico inválido');
      return;
    }
    setError('');
    sessionStorage.setItem(SINPE_SESSION_CONTACT_EMAIL, normalized);
    router.push('/withdraw/id');
  };

  if (isLoading) {
    return (
      <div className="flex min-h-[400px] items-center justify-center">
        <div className="text-gray-500">Cargando…</div>
      </div>
    );
  }

  return (
    <div className="grid w-full max-w-md gap-8">
      <StepProgress currentStep={3} totalSteps={7} />

      <StepHeader
        title="Tu correo electrónico"
        description="Lo usamos solo para registro y comunicación interna con Ridivi. No te enviamos correos automáticos a esta dirección."
        className="gap-4"
      />

      <div className="flex flex-col gap-4 px-2">
        <input
          type="email"
          inputMode="email"
          autoComplete="email"
          autoCapitalize="none"
          spellCheck={false}
          placeholder="nombre@ejemplo.com"
          value={email}
          onChange={(e) => {
            setEmail(e.target.value);
            setError('');
          }}
          className="w-full rounded-full border border-gray-300 px-6 py-5 text-center text-lg font-medium transition-colors focus:border-gray-900 focus:outline-none"
          style={{ background: 'var(--white-ridivi)' }}
        />
        {error ? (
          <p className="text-center text-sm font-medium text-red-600">{error}</p>
        ) : null}
      </div>

      <InfoBox>
        <div className="space-y-2 text-sm leading-relaxed text-gray-700">
          <p className="font-semibold text-gray-900">Privacidad</p>
          <p>
            Este correo queda asociado al retiro en nuestros registros y en el
            aviso que enviamos a Ridivi, junto con el resto de los datos del
            proceso.
          </p>
        </div>
      </InfoBox>

      <div className="px-2">
        <Button
          onClick={handleContinue}
          disabled={!canContinue}
          size="lg"
          variant="primary"
          className="w-full rounded-sm text-base font-medium tracking-wide shadow"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};
