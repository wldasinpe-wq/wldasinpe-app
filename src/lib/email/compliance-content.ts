import type { Withdrawal } from '@prisma/client';

/**
 * `contactEmail` exists on the DB model, but some toolchains resolve an older generated
 * `Withdrawal` shape; reading via a keyed record avoids property errors without lying about
 * the whole row type.
 */
function readWithdrawalContactEmail(row: Withdrawal): string | null {
  const v = (row as unknown as Record<string, unknown>)['contactEmail'];
  return typeof v === 'string' ? v : null;
}

function readExchangeRateMeta(row: Withdrawal): {
  source: string | null;
  fetchedAtIso: string | null;
} {
  const r = row as unknown as Record<string, unknown>;
  const source = r['exchangeRateSource'];
  const fetched = r['exchangeRateFetchedAt'];
  return {
    source: typeof source === 'string' ? source : null,
    fetchedAtIso:
      fetched instanceof Date
        ? fetched.toISOString()
        : typeof fetched === 'string'
          ? fetched
          : null,
  };
}

/** Fields required to build the Ridivi / internal compliance notification (plain text). */
export type WithdrawalComplianceEmailInput = {
  referenceId: string;
  walletAddress: string;
  phoneNumber: string;
  accountNumber: string;
  firstName: string;
  lastName: string;
  idNumber: string;
  /** User contact email collected in-app (SINPE flow). */
  contactEmail: string | null;
  amountWld: string;
  /** Estimated net CRC (label clearly in body). */
  amountCrcEstimated: string;
  exchangeRateCrcPerWld: string;
  /** `world` | `env` from DB, if present. */
  exchangeRateSource: string | null;
  /** ISO timestamp from DB (`exchangeRateFetchedAt`), if present. */
  exchangeRateFetchedAt: string | null;
  commissionCrc: string;
  transactionId: string | null;
  txHash: string | null;
};

function appEnvironmentLabel(): string {
  return process.env.VERCEL_ENV ?? process.env.NODE_ENV ?? 'development';
}

export function withdrawalToComplianceInput(
  row: Withdrawal
): WithdrawalComplianceEmailInput {
  const rateMeta = readExchangeRateMeta(row);
  return {
    referenceId: row.referenceId,
    walletAddress: row.walletAddress,
    phoneNumber: row.phoneNumber,
    accountNumber: row.accountNumber,
    firstName: row.firstName,
    lastName: row.lastName,
    idNumber: row.idNumber,
    contactEmail: readWithdrawalContactEmail(row),
    amountWld: row.amountWld.toString(),
    amountCrcEstimated: row.amountCrc.toString(),
    exchangeRateCrcPerWld: row.exchangeRate.toString(),
    exchangeRateSource: rateMeta.source,
    exchangeRateFetchedAt: rateMeta.fetchedAtIso,
    commissionCrc: row.commissionCrc.toString(),
    transactionId: row.transactionId,
    txHash: row.txHash,
  };
}

type ComplianceEmailSubjectInput = Pick<
  WithdrawalComplianceEmailInput,
  'referenceId' | 'txHash' | 'amountWld' | 'amountCrcEstimated'
>;

/**
 * Inbox-friendly subject: WLD→CRC amounts + short World Chain hash for explorer match.
 * Full hash stays in the body. When hash is missing, uses a shortened reference.
 */
export function buildComplianceEmailSubject(
  input: ComplianceEmailSubjectInput
): string {
  const wld = formatWldForSubject(input.amountWld);
  const crc = formatCrcForSubject(input.amountCrcEstimated);
  const amounts = `${wld} WLD → ${crc} CRC est.`;

  const shortHash = shortenTxHashForSubjectDisplay(input.txHash);
  const chainPart = shortHash
    ? `World Chain transaction hash ${shortHash}`
    : `sin hash aún - ref ${shortenRefForSubject(input.referenceId)}`;

  return `[Ridivi Withdraw · WLD a CRC] ${amounts} - ${chainPart}`;
}

function formatWldForSubject(raw: string): string {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return String(raw).trim();
  const s = n.toFixed(6).replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

function formatCrcForSubject(raw: string): string {
  const n = Number(String(raw).trim());
  if (!Number.isFinite(n)) return String(raw).trim();
  return Math.round(n).toLocaleString('es-CR');
}

/** `0x` + first/last hex (ellipsis) for mobile inbox truncation. */
function shortenTxHashForSubjectDisplay(
  raw: string | null | undefined
): string | null {
  const full = normalizeTxHashForSubject(raw);
  if (!full || full.length <= 18) return full;
  return `${full.slice(0, 10)}…${full.slice(-6)}`;
}

function shortenRefForSubject(ref: string): string {
  const t = ref.trim();
  if (t.length <= 14) return t;
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

function normalizeTxHashForSubject(
  raw: string | null | undefined
): string | null {
  const t = raw?.trim();
  if (!t) return null;
  const hex = t.startsWith('0x') || t.startsWith('0X') ? t.slice(2) : t;
  if (!/^[a-fA-F0-9]+$/i.test(hex) || hex.length < 8) return null;
  return `0x${hex.toLowerCase()}`;
}

/**
 * Plain-text body: Spanish intro + structured fields (aligned with infra docs).
 */
export function buildComplianceEmailPlainText(
  input: WithdrawalComplianceEmailInput,
  timestampUtc: Date
): string {
  const ts = timestampUtc.toISOString();
  const intro = [
    'Hola,',
    '',
    'Adjuntamos los datos del retiro en cadena y las imágenes del documento de identidad (frente y reverso) tal como fueron cargadas en la aplicación.',
    '',
    'A continuación el detalle estructurado:',
    '',
  ].join('\n');

  const data = [
    `referencia_retiro: ${input.referenceId}`,
    `direccion_billetera: ${input.walletAddress}`,
    `telefono_sinpe_movil: ${input.phoneNumber}`,
    `cuenta_destino: ${input.accountNumber}`,
    `nombre_legal: ${input.firstName} ${input.lastName}`.trim(),
    `numero_identificacion: ${input.idNumber}`,
    `email_contacto: ${input.contactEmail?.trim() || '(no proporcionado)'}`,
    `monto_wld: ${input.amountWld}`,
    `monto_crc_estimado_neto: ${input.amountCrcEstimated}`,
    `tipo_cambio_crc_por_wld: ${input.exchangeRateCrcPerWld}`,
    `origen_tipo_cambio: ${input.exchangeRateSource ?? '(no registrado)'}`,
    `tipo_cambio_snapshot_utc: ${input.exchangeRateFetchedAt ?? '(no registrado)'}`,
    `comision_crc: ${input.commissionCrc}`,
    `id_transaccion_proveedor: ${input.transactionId ?? '(pendiente)'}`,
    `hash_transaccion: ${input.txHash ?? '(pendiente)'}`,
    `marca_tiempo_utc: ${ts}`,
    `entorno: ${appEnvironmentLabel()}`,
    '',
    'Registro interno de la operación; no es comprobante oficial ni envío de compliance regulatorio por sí solo.',
  ].join('\n');

  return `${intro}${data}`;
}
