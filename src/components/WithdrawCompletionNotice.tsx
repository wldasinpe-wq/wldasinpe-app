'use client';

import { useRouter, useSearchParams } from 'next/navigation';
import { useEffect, useState } from 'react';

const SUPPORT_EMAIL = 'info@ridivi.com';

/**
 * Shown on /home after a successful withdraw (?retiro=completado).
 * Strips the query param so refresh does not repeat the banner.
 */
export function WithdrawCompletionNotice() {
  const searchParams = useSearchParams();
  const router = useRouter();
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (searchParams.get('retiro') !== 'completado') return;
    setOpen(true);
    router.replace('/home', { scroll: false });
  }, [searchParams, router]);

  if (!open) return null;

  return (
    <div
      className="w-full max-w-md rounded-sm border border-gray-900 bg-amber-50 px-4 py-3 text-center text-sm text-gray-800 shadow-sm"
      role="status"
    >
      <p className="font-semibold text-gray-900">Retiro enviado</p>
      <p className="mt-2 leading-relaxed">
        Si hay cualquier problema con tu retiro o el depósito en SINPE, escribinos a{' '}
        <a
          href={`mailto:${SUPPORT_EMAIL}`}
          className="font-medium text-gray-900 underline decoration-gray-400 underline-offset-2"
        >
          {SUPPORT_EMAIL}
        </a>
        .
      </p>
      <button
        type="button"
        onClick={() => setOpen(false)}
        className="mt-3 text-xs font-medium text-gray-600 underline decoration-gray-300 underline-offset-2"
      >
        Cerrar
      </button>
    </div>
  );
}
