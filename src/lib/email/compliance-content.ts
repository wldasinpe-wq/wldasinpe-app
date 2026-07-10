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
  /** World MiniKit payment id (`pay` success payload). */
  transactionId: string | null;
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
  };
}

type ComplianceEmailSubjectInput = Pick<
  WithdrawalComplianceEmailInput,
  'referenceId' | 'transactionId' | 'amountWld' | 'amountCrcEstimated'
>;

/**
 * Inbox-friendly subject: amounts + shortened World payment id for support lookup.
 */
export function buildComplianceEmailSubject(
  input: ComplianceEmailSubjectInput
): string {
  const wld = formatWldForSubject(input.amountWld);
  const crc = formatCrcForSubject(input.amountCrcEstimated);
  const amounts = `${wld} WLD → ${crc} CRC est.`;

  const tid = input.transactionId?.trim();
  const idPart = tid
    ? `World payment id ${shortenTransactionIdForSubject(tid)}`
    : `ref ${shortenRefForSubject(input.referenceId)}`;

  return `[Ridivi Withdraw · WLD a CRC] ${amounts} - ${idPart}`;
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

function shortenTransactionIdForSubject(id: string): string {
  const t = id.trim();
  if (t.length <= 18) return t;
  return `${t.slice(0, 10)}…${t.slice(-6)}`;
}

function shortenRefForSubject(ref: string): string {
  const t = ref.trim();
  if (t.length <= 14) return t;
  return `${t.slice(0, 8)}…${t.slice(-4)}`;
}

type ComplianceField = {
  key: string;
  value: string;
};

function formatFieldLabel(key: string): string {
  return key.replace(/_/g, ' ');
}

function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

function buildComplianceFields(
  input: WithdrawalComplianceEmailInput,
  timestampUtc: Date
): { beforeBreak: ComplianceField[]; afterBreak: ComplianceField[] } {
  const ts = timestampUtc.toISOString();

  const beforeBreak: ComplianceField[] = [
    { key: 'direccion_billetera', value: input.walletAddress },
    { key: 'telefono_sinpe_movil', value: input.phoneNumber },
    {
      key: 'nombre_legal',
      value: `${input.firstName} ${input.lastName}`.trim(),
    },
    { key: 'numero_identificacion', value: input.idNumber },
    {
      key: 'email_contacto',
      value: input.contactEmail?.trim() || '(no proporcionado)',
    },
    { key: 'monto_wld', value: input.amountWld },
    { key: 'monto_crc_estimado_neto', value: input.amountCrcEstimated },
    { key: 'tipo_cambio_crc_por_wld', value: input.exchangeRateCrcPerWld },
    {
      key: 'origen_tipo_cambio',
      value: input.exchangeRateSource ?? '(no registrado)',
    },
    {
      key: 'tipo_cambio_snapshot_utc',
      value: input.exchangeRateFetchedAt ?? '(no registrado)',
    },
    { key: 'comision_crc', value: input.commissionCrc },
    { key: 'referencia_retiro', value: input.referenceId },
  ];

  const afterBreak: ComplianceField[] = [
    {
      key: 'id_pago_world_minikit',
      value: input.transactionId ?? '(pendiente)',
    },
    { key: 'marca_tiempo_utc', value: ts },
    { key: 'entorno', value: appEnvironmentLabel() },
  ];

  return { beforeBreak, afterBreak };
}

function complianceEmailIntroLines(): string[] {
  return [
    'Hola,',
    '',
    'Adjuntamos los datos del retiro (incluido el id de pago World / MiniKit) y las imágenes del documento de identidad (frente y reverso) tal como fueron cargadas en la aplicación.',
    '',
    'A continuación el detalle estructurado:',
    '',
  ];
}

function formatComplianceFieldPlainText(field: ComplianceField): string {
  return `${formatFieldLabel(field.key)}: ${field.value}`;
}

function formatComplianceFieldHtml(field: ComplianceField): string {
  const label = escapeHtml(formatFieldLabel(field.key));
  const value = escapeHtml(field.value);
  return `<strong>${label}</strong>: ${value}`;
}

/**
 * Plain-text body: Spanish intro + structured fields (aligned with infra docs).
 */
export function buildComplianceEmailPlainText(
  input: WithdrawalComplianceEmailInput,
  timestampUtc: Date
): string {
  const { beforeBreak, afterBreak } = buildComplianceFields(
    input,
    timestampUtc
  );
  const intro = complianceEmailIntroLines().join('\n');

  const data = [
    ...beforeBreak.map(formatComplianceFieldPlainText),
    '',
    ...afterBreak.map(formatComplianceFieldPlainText),
    '',
    'Registro interno de la operación; no es comprobante oficial ni envío de compliance regulatorio por sí solo.',
  ].join('\n');

  return `${intro}${data}`;
}

/**
 * HTML body: same content as plain text with bold field labels.
 */
export function buildComplianceEmailHtml(
  input: WithdrawalComplianceEmailInput,
  timestampUtc: Date
): string {
  const { beforeBreak, afterBreak } = buildComplianceFields(
    input,
    timestampUtc
  );
  const intro = complianceEmailIntroLines()
    .map((line) =>
      line === ''
        ? '<br>'
        : `<p style="margin:0 0 0.75em 0;">${escapeHtml(line)}</p>`
    )
    .join('\n');

  const data = [
    ...beforeBreak.map(formatComplianceFieldHtml),
    '<br>',
    ...afterBreak.map(formatComplianceFieldHtml),
    '<br>',
    '<p style="margin:0.75em 0 0 0;">Registro interno de la operación; no es comprobante oficial ni envío de compliance regulatorio por sí solo.</p>',
  ].join('<br>\n');

  return `<!DOCTYPE html>
<html lang="es">
<body style="font-family:sans-serif;font-size:14px;line-height:1.5;color:#111;">
${intro}
${data}
</body>
</html>`;
}
