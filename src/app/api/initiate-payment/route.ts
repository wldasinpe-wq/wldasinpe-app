import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import { LIMITS } from '@/constants/exchange';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

/**
 * Validates withdrawal intent and returns a reference id for MiniKit `pay()`.
 * Does **not** persist to the DB — the first write happens in `complete-withdrawal`
 * after the on-chain payment is confirmed (avoids "Esperando el pago" if the user
 * leaves step 7 without paying).
 */
export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.walletAddress) {
    return NextResponse.json(
      { error: 'No autorizado. Volvé a iniciar sesión.' },
      { status: 401 }
    );
  }

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const phoneNumber = body.phoneNumber;
    const amountWLD = body.amountWLD;
    const firstName = body.firstName;
    const idNumber = body.idNumber;
    const accountNumber = body.accountNumber;
    if (!isNonEmptyString(phoneNumber)) {
      return NextResponse.json(
        { error: 'El número de teléfono es obligatorio.' },
        { status: 400 }
      );
    }

    const amount =
      typeof amountWLD === 'string'
        ? parseFloat(amountWLD)
        : Number(amountWLD);

    if (!Number.isFinite(amount) || amount < LIMITS.MIN_WLD) {
      return NextResponse.json(
        {
          error: `El monto mínimo es ${LIMITS.MIN_WLD} WLD.`,
        },
        { status: 400 }
      );
    }

    if (
      !isNonEmptyString(firstName) ||
      !isNonEmptyString(idNumber) ||
      !isNonEmptyString(accountNumber)
    ) {
      return NextResponse.json(
        {
          error:
            'Faltan datos del destinatario. Volvé al retiro y verificá el número SINPE.',
        },
        { status: 400 }
      );
    }

    const referenceId = crypto.randomUUID().replace(/-/g, '');

    return NextResponse.json({ id: referenceId });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json(
      { error: 'Error interno. Intentá de nuevo más tarde.' },
      { status: 500 }
    );
  }
}
