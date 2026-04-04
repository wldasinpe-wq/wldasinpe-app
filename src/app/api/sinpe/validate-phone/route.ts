import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';
import {
  fetchRidiviPhoneInfo,
  fetchRidiviToken,
  normalizeSinpePhoneDigits,
} from '@/lib/ridivi/sinpe';

export async function POST(req: NextRequest) {
  const session = await auth();
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const baseUrl = process.env.RIDIVI_API_BASE_URL?.trim();
  const key = process.env.RIDIVI_API_KEY?.trim();
  const secret = process.env.RIDIVI_API_SECRET?.trim();

  if (!baseUrl || !key || !secret) {
    console.error('Ridivi env missing: RIDIVI_API_BASE_URL / KEY / SECRET');
    return NextResponse.json(
      { error: 'Configuración del servicio incompleta' },
      { status: 503 }
    );
  }

  let body: { phoneNumber?: string };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'JSON inválido' }, { status: 400 });
  }

  const raw = body.phoneNumber?.trim();
  if (!raw) {
    return NextResponse.json(
      { error: 'Número de teléfono requerido' },
      { status: 400 }
    );
  }

  const digits = normalizeSinpePhoneDigits(raw);
  if (!digits) {
    return NextResponse.json(
      { error: 'Formato de teléfono inválido (8 dígitos)' },
      { status: 400 }
    );
  }

  async function validateWithToken(token: string) {
    return fetchRidiviPhoneInfo(baseUrl, token, digits);
  }

  try {
    let token = await fetchRidiviToken(baseUrl, key, secret);
    let info: Awaited<ReturnType<typeof validateWithToken>>;
    try {
      info = await validateWithToken(token);
    } catch (first) {
      const err = first as Error & { status?: number };
      if (err.status === 401) {
        token = await fetchRidiviToken(baseUrl, key, secret);
        info = await validateWithToken(token);
      } else {
        throw first;
      }
    }

    if (!info.Activo) {
      return NextResponse.json(
        {
          error:
            'Esta cuenta SINPE Móvil no está activa. Verificá con tu banco.',
        },
        { status: 422 }
      );
    }

    return NextResponse.json({
      nombreCliente: info.NombreCliente,
      identificacion: info.Identificacion,
      cuentaInterna: info.CuentaInterna,
      numTelefono: info.NumTelefono,
    });
  } catch (e) {
    const err = e as Error & { status?: number; ridiviCode?: string };

    if (err.status === 409 || err.ridiviCode === '222') {
      return NextResponse.json(
        {
          error:
            'Este número no está registrado en SINPE Móvil o no está asociado a una cuenta.',
        },
        { status: 422 }
      );
    }

    if (err.status === 401) {
      return NextResponse.json(
        { error: 'No se pudo autenticar con el proveedor. Intentá de nuevo.' },
        { status: 502 }
      );
    }

    console.error('validate-phone:', err.message);
    return NextResponse.json(
      { error: 'No se pudo verificar el número. Intentá más tarde.' },
      { status: 502 }
    );
  }
}
