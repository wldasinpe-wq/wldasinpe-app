const TOKEN_PATH = '/v5/auth/token';
const PHONE_DATA_PATH = '/v5/sinpe/getPhoneData';

type RidiviPhoneData = {
  IdMonedero: number;
  CodEntidad: number;
  Identificacion: string;
  NombreCliente: string;
  NumTelefono: number;
  Activo: boolean;
  FechaRegistro: string;
  limiteEntrante: number;
  limiteSaliente: number;
};

type RidiviErrorBody = {
  code?: string;
  title?: string;
  detail?: string | null;
};

function joinUrl(base: string, path: string): string {
  return `${base.replace(/\/$/, '')}${path}`;
}

export async function fetchRidiviToken(
  baseUrl: string,
  key: string,
  secret: string
): Promise<string> {
  const res = await fetch(joinUrl(baseUrl, TOKEN_PATH), {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ key, secret }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Ridivi token: invalid JSON response');
  }

  if (!res.ok) {
    const err = data as RidiviErrorBody;
    throw new Error(
      err.title || err.detail || `Ridivi auth failed (${res.status})`
    );
  }

  const token = (data as { token?: string }).token;
  if (!token) {
    throw new Error('Ridivi token: missing token in response');
  }
  return token;
}

export async function fetchRidiviPhoneData(
  baseUrl: string,
  bearerToken: string,
  phone: string
): Promise<RidiviPhoneData> {
  const res = await fetch(joinUrl(baseUrl, PHONE_DATA_PATH), {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: `Bearer ${bearerToken}`,
    },
    body: JSON.stringify({ phone }),
  });

  const text = await res.text();
  let data: unknown;
  try {
    data = text ? JSON.parse(text) : {};
  } catch {
    throw new Error('Ridivi getPhoneData: invalid JSON response');
  }

  if (!res.ok) {
    const err = data as RidiviErrorBody;
    const e = new Error(
      err.title || err.detail || `Ridivi getPhoneData failed (${res.status})`
    );
    (e as Error & { status: number; ridiviCode?: string }).status = res.status;
    (e as Error & { ridiviCode?: string }).ridiviCode = err.code;
    throw e;
  }

  return data as RidiviPhoneData;
}

/** 8 digits only for Ridivi API */
export function normalizeSinpePhoneDigits(input: string): string | null {
  let d = input.replace(/\D/g, '');
  if (d.startsWith('506') && d.length === 11) {
    d = d.slice(3);
  }
  if (d.length !== 8 || !/^\d{8}$/.test(d)) {
    return null;
  }
  return d;
}
