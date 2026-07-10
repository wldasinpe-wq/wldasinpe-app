'use client';

import type { WithdrawalStatus } from '@prisma/client';
import { formatCurrency } from '@/constants/exchange';
import { hapticPrimary, hapticSuccess } from '@/lib/haptics';
import type { WithdrawalDisplayPhase } from '@/lib/withdrawal-display';
import { Check, Copy, ExternalLink } from 'lucide-react';
import { useCallback, useState } from 'react';

export type ProfileWithdrawalRow = {
  id: string;
  referenceId: string;
  status: WithdrawalStatus;
  displayPhase: WithdrawalDisplayPhase;
  amountWld: string;
  amountCrc: string;
  exchangeRate: string;
  commissionCrc: string;
  createdAt: string;
  transactionId: string | null;
  txHash: string | null;
};

const PHASE_COPY: Record<
  WithdrawalDisplayPhase,
  { title: string; subtitle: string }
> = {
  awaiting_payment: {
    title: 'Esperando el pago',
    subtitle:
      'Aún no registramos la confirmación del envío de WLD desde World App.',
  },
  transfer_ok_email_processing: {
    title: 'Pago registrado',
    subtitle:
      'World App confirmó el envío; estamos terminando el aviso a Ridivi.',
  },
  transfer_ok_email_failed: {
    title: 'Pago registrado; aviso no enviado',
    subtitle:
      'El pago figura con id World, pero no pudimos enviar el correo a Ridivi. Usá los datos de abajo o escribinos con la referencia.',
  },
  transfer_failed_chain: {
    title: 'Retiro con error',
    subtitle:
      'Este retiro quedó con un error de validación. Escribinos con la referencia si necesitás ayuda.',
  },
  completed: {
    title: 'Retiro completado',
    subtitle: 'Pago registrado en World y aviso enviado a Ridivi.',
  },
  withdrawal_marked_failed: {
    title: 'Retiro no completado',
    subtitle: 'Este retiro quedó marcado como fallido. Escribinos si necesitás ayuda.',
  },
};

const WORLDCAN_TX = 'https://worldscan.org/tx/';

function CopyRow({
  label,
  value,
  mono,
  onCopy,
  copied,
  copyKey,
  href,
}: {
  label: string;
  value: string;
  mono?: boolean;
  onCopy: (key: string, text: string) => void;
  copied: string | null;
  copyKey: string;
  href?: string;
}) {
  const isCopied = copied === copyKey;
  return (
    <div className="space-y-1">
      <p className="text-xs font-medium text-gray-500">{label}</p>
      <div className="flex flex-wrap items-center gap-1.5">
        <p
          className={`text-sm text-gray-900 break-all flex-1 min-w-0 ${mono ? 'font-mono text-xs' : ''}`}
        >
          {value}
        </p>
        <button
          type="button"
          className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 active:opacity-80"
          onClick={() => onCopy(copyKey, value)}
          aria-label={isCopied ? 'Copiado' : 'Copiar al portapapeles'}
        >
          {isCopied ? (
            <Check className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          ) : (
            <Copy className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          )}
        </button>
        {href ? (
          <a
            href={href}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-50 text-blue-700 active:opacity-80"
            aria-label="Abrir en explorador de la red"
          >
            <ExternalLink className="h-4 w-4" strokeWidth={2.25} aria-hidden />
          </a>
        ) : null}
      </div>
    </div>
  );
}

export function WithdrawalHistoryItem({
  w,
  walletAddress,
}: {
  w: ProfileWithdrawalRow;
  walletAddress: string;
}) {
  const [open, setOpen] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);

  const phase = PHASE_COPY[w.displayPhase];

  const copy = useCallback(async (key: string, text: string) => {
    try {
      await navigator.clipboard.writeText(text);
      hapticSuccess();
      setCopied(key);
      setTimeout(() => setCopied(null), 2000);
    } catch {
      hapticPrimary();
    }
  }, []);

  const toggle = useCallback(() => {
    hapticPrimary();
    setOpen((o) => !o);
  }, []);

  const amountWld = Number(w.amountWld);
  const amountCrc = Number(w.amountCrc);
  const rate = Number(w.exchangeRate);
  const fee = Number(w.commissionCrc);
  const tx = w.txHash?.trim() ?? '';
  const txExplorer = tx ? `${WORLDCAN_TX}${tx}` : undefined;

  return (
    <li className="rounded-xl border border-gray-200 bg-white/80 overflow-hidden">
      <button
        type="button"
        className="w-full text-left p-4 flex flex-col gap-1"
        onClick={toggle}
        aria-expanded={open}
      >
        <div className="flex justify-between gap-2 items-start">
          <span className="text-xs text-gray-500">
            {new Date(w.createdAt).toLocaleString('es-CR', {
              dateStyle: 'short',
              timeStyle: 'short',
            })}
          </span>
          <span className="text-xs font-medium text-gray-500 shrink-0">
            {open ? 'Ocultar detalles' : 'Ver detalles'}
          </span>
        </div>
        <p className="font-semibold text-gray-900 leading-snug">{phase.title}</p>
        <p className="text-sm text-gray-600 leading-snug">{phase.subtitle}</p>
        <p className="text-sm text-gray-800 mt-1">
          {formatCurrency.WLD(amountWld)} → {formatCurrency.CRC(amountCrc)}{' '}
          <span className="text-gray-500">(neto est.)</span>
        </p>
      </button>

      {open ? (
        <div className="px-4 pb-4 pt-0 border-t border-gray-100 space-y-4">
          <p className="text-xs text-gray-500 pt-3">
            Datos de referencia. Tocá «Copiar» cuando los necesites.
          </p>

          <CopyRow
            label="Referencia del retiro"
            value={w.referenceId}
            mono
            onCopy={copy}
            copied={copied}
            copyKey={`${w.id}-ref`}
          />

          {w.transactionId?.trim() ? (
            <CopyRow
              label="ID de pago (World / MiniKit)"
              value={w.transactionId.trim()}
              mono
              onCopy={copy}
              copied={copied}
              copyKey={`${w.id}-tid`}
            />
          ) : null}

          {tx ? (
            <CopyRow
              label="Hash en blockchain (opcional)"
              value={tx}
              mono
              onCopy={copy}
              copied={copied}
              copyKey={`${w.id}-tx`}
              href={txExplorer}
            />
          ) : null}

          <CopyRow
            label="Tu billetera (World App)"
            value={walletAddress}
            mono
            onCopy={copy}
            copied={copied}
            copyKey={`${w.id}-wallet`}
          />

          <div className="grid gap-3 sm:grid-cols-2 text-sm">
            <div>
              <p className="text-xs font-medium text-gray-500">Tasa usada</p>
              <p className="text-gray-900">
                {Number.isFinite(rate)
                  ? `${formatCurrency.CRC(rate)} por 1 WLD`
                  : '—'}
              </p>
            </div>
            <div>
              <p className="text-xs font-medium text-gray-500">
                Comisión fija (estimada)
              </p>
              <p className="text-gray-900">
                {Number.isFinite(fee) ? formatCurrency.CRC(fee) : '—'}
              </p>
            </div>
            <div className="sm:col-span-2">
              <p className="text-xs font-medium text-gray-500">
                Monto neto en colones (estimado)
              </p>
              <p className="text-gray-900">
                {Number.isFinite(amountCrc) ? formatCurrency.CRC(amountCrc) : '—'}
              </p>
            </div>
          </div>

          <p className="text-[11px] text-gray-400 leading-relaxed">
            Los montos en colones son estimaciones al momento del retiro.
          </p>
        </div>
      ) : null}
    </li>
  );
}
