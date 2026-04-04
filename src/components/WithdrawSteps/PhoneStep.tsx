'use client';
import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import { useState } from 'react';
import { useRouter } from 'next/navigation';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';
import { InfoBox } from './ui/InfoBox';
import {
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';

/**
 * Validates Costa Rica phone number format
 */
const validateCostaRicaPhone = (phone: string): boolean => {
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  const patterns = [
    /^[0-9]{8}$/,
    /^\+506[0-9]{8}$/,
    /^506[0-9]{8}$/,
  ];
  
  const isValid = patterns.some(pattern => pattern.test(cleaned));
  
  if (cleaned.startsWith('506') || cleaned.startsWith('+506')) {
    const numberPart = cleaned.replace(/^\+?506/, '');
    return numberPart.length === 8 && /^[0-9]{8}$/.test(numberPart);
  }
  
  return isValid;
};

export const PhoneStep = () => {
  const router = useRouter();
  const [phoneNumber, setPhoneNumber] = useState('');
  const [error, setError] = useState<string>('');
  const [isValidating, setIsValidating] = useState(false);

  const formatPhoneNumber = (value: string) => {
    // Remover todo excepto dígitos
    const cleaned = value.replace(/\D/g, '');
    
    // Si tiene más de 4 dígitos, agregar el guión
    if (cleaned.length > 4) {
      return `${cleaned.slice(0, 4)}-${cleaned.slice(4, 8)}`;
    }
    
    return cleaned;
  };

  const handlePhoneChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const input = e.target.value;
    const formatted = formatPhoneNumber(input);
    setPhoneNumber(formatted);
    setError('');
  };

  const isValidPhone = validateCostaRicaPhone(phoneNumber);

  const handleContinue = async () => {
    if (!phoneNumber.trim()) {
      setError('Por favor ingresa un número de teléfono');
      return;
    }

    if (!validateCostaRicaPhone(phoneNumber)) {
      setError('Número de teléfono inválido. Debe tener exactamente 8 dígitos');
      return;
    }

    setIsValidating(true);
    setError('');

    try {
      const res = await fetch('/api/sinpe/validate-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phoneNumber: phoneNumber.trim() }),
      });

      const data = (await res.json().catch(() => ({}))) as {
        error?: string;
        nombreCliente?: string;
        identificacion?: string;
        cuentaInterna?: string;
      };

      if (!res.ok) {
        setError(
          data.error ||
            'No se pudo verificar el número. Intentá de nuevo.'
        );
        return;
      }

      sessionStorage.setItem(SINPE_SESSION_PHONE, phoneNumber.trim());
      sessionStorage.setItem(
        SINPE_SESSION_PROFILE,
        JSON.stringify({
          nombreCliente: data.nombreCliente,
          identificacion: data.identificacion,
          cuentaInterna: data.cuentaInterna,
        })
      );

      router.push('/withdraw/confirm');
    } catch {
      setError('Error de conexión. Verificá tu red e intentá de nuevo.');
    } finally {
      setIsValidating(false);
    }
  };

  return (
    <div className="grid w-full gap-8 max-w-md">
      <StepProgress currentStep={1} totalSteps={6} />

      <StepHeader
        title="Número de SINPE Móvil"
        description="Ingresá tu número de teléfono asociado a tu cuenta bancaria"
      />

      {/* Phone Input */}
      <div className="flex flex-col gap-4 px-2">
        <input
          type="tel"
          placeholder="8888-8888"
          value={phoneNumber}
          onChange={handlePhoneChange}
          className="w-full px-6 py-8 text-3xl text-center font-semibold border border-gray-300 rounded-full focus:outline-none focus:border-gray-900 transition-colors"
          style={{ background: 'var(--white-ridivi)' }}
          maxLength={9}
          autoFocus
        />
        {error && (
          <p className="text-sm text-red-600 text-center font-medium">{error}</p>
        )}
      </div>

      <InfoBox>
        <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
          <p className="font-semibold text-gray-900">¿Qué es SINPE Móvil?</p>
          <p>
            Sistema de pagos del Banco Central de Costa Rica. Tu dinero llegará directamente a la cuenta bancaria asociada a este número.
          </p>
        </div>
      </InfoBox>

      {/* Continue Button */}
      <div className="space-y-3 px-2">
        <Button
          onClick={() => void handleContinue()}
          disabled={!isValidPhone || isValidating}
          size="lg"
          variant="primary"
          className="w-full text-base font-medium tracking-wide rounded-sm shadow"
        >
          {isValidating ? 'Verificando…' : 'Continuar'}
        </Button>
      </div>
    </div>
  );
};
