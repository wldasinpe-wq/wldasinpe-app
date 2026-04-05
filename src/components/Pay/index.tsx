'use client';
import { Button, LiveFeedback } from '@worldcoin/mini-apps-ui-kit-react';
import { MiniKit, Tokens, tokenToDecimals } from '@worldcoin/minikit-js';
import { useState } from 'react';

/**
 * Validates Costa Rica phone number format
 * Costa Rica phone numbers are exactly 8 digits
 * Accepts: 8 digits (88888888), +50688888888, or 50688888888
 * Formats with dashes/spaces are also accepted: 8888-8888, 8888 8888
 */
const validateCostaRicaPhone = (phone: string): boolean => {
  // Remove spaces, dashes, parentheses, and plus sign for validation
  const cleaned = phone.replace(/[\s\-()]/g, '');
  
  // Must be exactly 8 digits, or 8 digits with country code (+506 or 506)
  const patterns = [
    /^[0-9]{8}$/,           // 88888888 (exactly 8 digits)
    /^\+506[0-9]{8}$/,      // +50688888888
    /^506[0-9]{8}$/,        // 50688888888
  ];
  
  const isValid = patterns.some(pattern => pattern.test(cleaned));
  
  // Additional check: if it has country code, the number part must be 8 digits
  if (cleaned.startsWith('506') || cleaned.startsWith('+506')) {
    const numberPart = cleaned.replace(/^\+?506/, '');
    return numberPart.length === 8 && /^[0-9]{8}$/.test(numberPart);
  }
  
  return isValid;
};

/**
 * This component is used to pay a user
 * The payment command simply does an ERC20 transfer
 * But, it also includes a reference field that you can search for on-chain
 */
export const Pay = () => {
  const [buttonState, setButtonState] = useState<
    'pending' | 'success' | 'failed' | undefined
  >(undefined);
  const [phoneNumber, setPhoneNumber] = useState('');
  const [amountWLD, setAmountWLD] = useState('0.5');
  const [error, setError] = useState<string>('');

  const onClickPay = async () => {
    // Validar que el teléfono esté ingresado
    if (!phoneNumber.trim()) {
      setError('Por favor ingresa un número de teléfono');
      return;
    }

    // Validar formato de teléfono costarricense
    if (!validateCostaRicaPhone(phoneNumber)) {
      setError('Número de teléfono inválido. Debe tener exactamente 8 dígitos (ej: 8888-8888 o +506 8888-8888)');
      return;
    }

    setError('');
    
    // Dirección del receptor desde variable de entorno
    const RECIPIENT_ADDRESS = process.env.NEXT_PUBLIC_RIDIVI_WALLET_ADDRESS || '0xce58b0A297714367b4dF592f3Aba82dA4e690b3a';
    
    if (!RECIPIENT_ADDRESS || RECIPIENT_ADDRESS === '0x0000000000000000000000000000000000000000') {
      setError('Dirección del receptor no configurada');
      return;
    }
    
    setButtonState('pending');

    try {
      // Crear payment con información del teléfono
      const res = await fetch('/api/initiate-payment', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          phoneNumber: phoneNumber.trim(),
          amountWLD: parseFloat(amountWLD),
          firstName: 'Demo',
          lastName: 'Pay',
          idNumber: '000000000',
          accountNumber: '000000000000',
          idFrontSubmitted: true,
          idBackSubmitted: true,
        }),
      });

      if (!res.ok) {
        throw new Error('Error al crear el pago');
      }

      const { id } = await res.json();

      // Intentar obtener el username de la dirección del receptor
      // Si la dirección tiene un username en World App, se mostrará en el modal
      // NOTA: Para wallets externas (como Rabby), esto probablemente no funcionará
      // y World App mostrará "test" o la dirección truncada por defecto
      let recipientDisplayName = '';
      try {
        const recipientInfo = await MiniKit.getUserByAddress(RECIPIENT_ADDRESS);
        console.log('Recipient info:', recipientInfo);
        if (recipientInfo?.username) {
          recipientDisplayName = recipientInfo.username;
        } else {
          // Si no tiene username, usar la dirección formateada
          recipientDisplayName = `${RECIPIENT_ADDRESS.slice(0, 6)}...${RECIPIENT_ADDRESS.slice(-4)}`;
        }
      } catch (error) {
        console.log('No se pudo obtener username para la dirección:', error);
        // Si falla, usar la dirección formateada
        recipientDisplayName = `${RECIPIENT_ADDRESS.slice(0, 6)}...${RECIPIENT_ADDRESS.slice(-4)}`;
      }
      
      console.log('Enviando pago a:', RECIPIENT_ADDRESS);
      console.log('Display name:', recipientDisplayName);

      const result = await MiniKit.commandsAsync.pay({
        reference: id,
        to: RECIPIENT_ADDRESS,
        tokens: [
          {
            symbol: Tokens.WLD,
            token_amount: tokenToDecimals(parseFloat(amountWLD), Tokens.WLD).toString(),
          },
        ],
        description: `Payment to ${recipientDisplayName} (${phoneNumber}) - ${amountWLD} WLD`,
      });

      console.log(result.finalPayload);
      if (result.finalPayload.status === 'success') {
        setButtonState('success');
        // Limpiar el formulario después de éxito
        setTimeout(() => {
          setPhoneNumber('');
          setAmountWLD('0.5');
          setButtonState(undefined);
        }, 3000);
      } else {
        setButtonState('failed');
        setTimeout(() => {
          setButtonState(undefined);
        }, 3000);
      }
    } catch (err) {
      console.error('Error processing payment:', err);
      setButtonState('failed');
      setError('Error al procesar el pago. Por favor intenta de nuevo.');
      setTimeout(() => {
        setButtonState(undefined);
        setError('');
      }, 3000);
    }
  };

  return (
    <div className="grid w-full gap-4">
      <p className="text-lg font-semibold">Pay</p>
      
      {/* Campo para número de teléfono */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Número de teléfono (SINPE)
        </label>
        <input
          type="tel"
          placeholder="Ej: 8888-8888 o +506 8888-8888"
          value={phoneNumber}
          onChange={(e) => {
            setPhoneNumber(e.target.value);
            setError('');
          }}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={buttonState === 'pending'}
          maxLength={15}
        />
        {error && (
          <p className="text-xs text-red-500">{error}</p>
        )}
        <p className="text-xs text-gray-500">
          Formato: 8 dígitos (ej: 8888-8888)
        </p>
      </div>

      {/* Campo para cantidad */}
      <div className="flex flex-col gap-2">
        <label className="text-sm font-medium text-gray-700">
          Cantidad en WLD
        </label>
        <input
          type="number"
          step="0.1"
          min="0.1"
          placeholder="0.5"
          value={amountWLD}
          onChange={(e) => setAmountWLD(e.target.value)}
          className="border border-gray-300 rounded-lg px-4 py-2 focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={buttonState === 'pending'}
        />
        <p className="text-xs text-gray-500">
          Mínimo: 0.1 WLD (aprox. $0.1 USD)
        </p>
      </div>

      <LiveFeedback
        label={{
          failed: 'Payment failed',
          pending: 'Payment pending',
          success: 'Payment successful',
        }}
        state={buttonState}
        className="w-full"
      >
        <Button
          onClick={onClickPay}
          disabled={buttonState === 'pending' || !phoneNumber.trim()}
          size="lg"
          variant="primary"
          className="w-full"
        >
          Pay
        </Button>
      </LiveFeedback>
    </div>
  );
};
