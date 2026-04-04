'use client';

import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import NextImage from 'next/image';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  SINPE_SESSION_ID_BACK,
  SINPE_SESSION_ID_FRONT,
  SINPE_SESSION_PHONE,
  SINPE_SESSION_PROFILE,
} from '@/constants/sinpe-session';
import { StepProgress } from './ui/StepProgress';
import { StepHeader } from './ui/StepHeader';
import { InfoBox } from './ui/InfoBox';

const MAX_ORIGINAL_BYTES = 12 * 1024 * 1024;
const COMPRESS_MAX_WIDTH = 1280;
const JPEG_QUALITY = 0.82;

async function compressImageFile(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const objectUrl = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      let { width, height } = img;
      if (width > COMPRESS_MAX_WIDTH) {
        height = (height * COMPRESS_MAX_WIDTH) / width;
        width = COMPRESS_MAX_WIDTH;
      }
      const canvas = document.createElement('canvas');
      canvas.width = Math.round(width);
      canvas.height = Math.round(height);
      const ctx = canvas.getContext('2d');
      if (!ctx) {
        reject(new Error('Canvas no disponible'));
        return;
      }
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
      resolve(canvas.toDataURL('image/jpeg', JPEG_QUALITY));
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('No se pudo leer la imagen'));
    };
    img.src = objectUrl;
  });
}

type CaptureSlot = 'front' | 'back';

export const IdCaptureStep = () => {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(true);
  const [frontDataUrl, setFrontDataUrl] = useState<string | null>(null);
  const [backDataUrl, setBackDataUrl] = useState<string | null>(null);
  const [error, setError] = useState('');
  const [isProcessing, setIsProcessing] = useState(false);
  const frontInputRef = useRef<HTMLInputElement>(null);
  const backInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    const phone = sessionStorage.getItem(SINPE_SESSION_PHONE);
    const profile = sessionStorage.getItem(SINPE_SESSION_PROFILE);
    if (!phone || !profile) {
      router.replace('/withdraw/phone');
      return;
    }
    setFrontDataUrl(sessionStorage.getItem(SINPE_SESSION_ID_FRONT));
    setBackDataUrl(sessionStorage.getItem(SINPE_SESSION_ID_BACK));
    setIsLoading(false);
  }, [router]);

  const pickForSlot = useCallback((slot: CaptureSlot) => {
    setError('');
    const ref = slot === 'front' ? frontInputRef : backInputRef;
    ref.current?.click();
  }, []);

  const handleFile = useCallback(
    async (file: File | undefined, slot: CaptureSlot) => {
      if (!file || !file.type.startsWith('image/')) {
        setError('Elegí un archivo de imagen válido');
        return;
      }
      if (file.size > MAX_ORIGINAL_BYTES) {
        setError('La imagen es demasiado grande. Probá con otra foto.');
        return;
      }
      setIsProcessing(true);
      setError('');
      try {
        const dataUrl = await compressImageFile(file);
        if (slot === 'front') {
          setFrontDataUrl(dataUrl);
        } else {
          setBackDataUrl(dataUrl);
        }
      } catch {
        setError('No se pudo procesar la imagen. Intentá de nuevo.');
      } finally {
        setIsProcessing(false);
      }
    },
    []
  );

  const onFrontChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    void handleFile(f, 'front');
    e.target.value = '';
  };

  const onBackChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    void handleFile(f, 'back');
    e.target.value = '';
  };

  const handleContinue = () => {
    if (!frontDataUrl || !backDataUrl) {
      setError('Necesitamos el frente y el reverso del documento');
      return;
    }
    sessionStorage.setItem(SINPE_SESSION_ID_FRONT, frontDataUrl);
    sessionStorage.setItem(SINPE_SESSION_ID_BACK, backDataUrl);
    router.push('/withdraw/amount');
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="text-gray-500">Cargando…</div>
      </div>
    );
  }

  const bothReady = Boolean(frontDataUrl && backDataUrl);

  return (
    <div className="grid w-full gap-8 max-w-md">
      <StepProgress currentStep={3} totalSteps={6} />

      <StepHeader
        title="Identificación"
        description="Subí el frente y el reverso de tu cédula o documento de identidad"
        className="gap-4"
      />

      <input
        ref={frontInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onFrontChange}
      />
      <input
        ref={backInputRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={onBackChange}
      />

      <div className="flex flex-col gap-4 px-2">
        <div
          className="border border-gray-900 overflow-hidden"
          style={{ background: 'var(--white-ridivi)' }}
        >
          <div className="px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-600 uppercase tracking-wide">
            Frente
          </div>
          <button
            type="button"
            onClick={() => pickForSlot('front')}
            disabled={isProcessing}
            className="w-full aspect-4/3 flex flex-col items-center justify-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {frontDataUrl ? (
              <NextImage
                src={frontDataUrl}
                alt="Frente del documento"
                width={800}
                height={600}
                unoptimized
                className="w-full h-full object-contain max-h-48"
              />
            ) : (
              <span className="px-4 text-center">
                Tocá para tomar o elegir foto
              </span>
            )}
          </button>
        </div>

        <div
          className="border border-gray-900 overflow-hidden"
          style={{ background: 'var(--white-ridivi)' }}
        >
          <div className="px-4 py-2 border-b border-gray-200 text-xs font-medium text-gray-600 uppercase tracking-wide">
            Reverso
          </div>
          <button
            type="button"
            onClick={() => pickForSlot('back')}
            disabled={isProcessing || !frontDataUrl}
            className="w-full aspect-4/3 flex flex-col items-center justify-center gap-2 text-sm text-gray-600 hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {backDataUrl ? (
              <NextImage
                src={backDataUrl}
                alt="Reverso del documento"
                width={800}
                height={600}
                unoptimized
                className="w-full h-full object-contain max-h-48"
              />
            ) : (
              <span className="px-4 text-center">
                {!frontDataUrl
                  ? 'Primero subí el frente'
                  : 'Tocá para tomar o elegir foto'}
              </span>
            )}
          </button>
        </div>

        {error && (
          <p className="text-sm text-red-600 text-center font-medium">{error}</p>
        )}
        {isProcessing && (
          <p className="text-sm text-gray-500 text-center">Procesando imagen…</p>
        )}
      </div>

      <InfoBox>
        <div className="text-sm text-gray-700 space-y-2 leading-relaxed">
          <p className="font-semibold text-gray-900">Privacidad</p>
          <p>
            Las fotos se guardan solo en este dispositivo hasta completar el
            retiro. Más adelante podrán enviarse de forma segura al proveedor
            para cumplimiento normativo.
          </p>
        </div>
      </InfoBox>

      <div className="space-y-3 px-2">
        <Button
          onClick={handleContinue}
          disabled={!bothReady || isProcessing}
          size="lg"
          variant="primary"
          className="w-full text-base font-medium tracking-wide rounded-sm shadow"
        >
          Continuar
        </Button>
      </div>
    </div>
  );
};
