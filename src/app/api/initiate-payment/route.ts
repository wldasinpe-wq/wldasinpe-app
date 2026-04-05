import { Prisma } from '@prisma/client';
import { NextRequest, NextResponse } from 'next/server';

import { auth } from '@/auth';
import {
  calculateConversion,
  EXCHANGE_RATES,
  LIMITS,
} from '@/constants/exchange';
import { prisma } from '@/lib/prisma';

function isNonEmptyString(v: unknown): v is string {
  return typeof v === 'string' && v.trim().length > 0;
}

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user?.walletAddress) {
    return NextResponse.json(
      { error: 'No autorizado. Volvé a iniciar sesión.' },
      { status: 401 }
    );
  }

  const walletAddress = session.user.walletAddress;

  try {
    const body = (await req.json()) as Record<string, unknown>;

    const phoneNumber = body.phoneNumber;
    const amountWLD = body.amountWLD;
    const firstName = body.firstName;
    const lastNameRaw = body.lastName;
    const idNumber = body.idNumber;
    const accountNumber = body.accountNumber;
    const idFrontSubmitted = Boolean(body.idFrontSubmitted);
    const idBackSubmitted = Boolean(body.idBackSubmitted);
    const contactEmailRaw = body.contactEmail;
    const contactEmail =
      typeof contactEmailRaw === 'string' && contactEmailRaw.trim()
        ? contactEmailRaw.trim()
        : null;

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

    const lastName =
      typeof lastNameRaw === 'string' ? lastNameRaw.trim() : '';

    if (
      !isNonEmptyString(firstName) ||
      !isNonEmptyString(idNumber) ||
      !isNonEmptyString(accountNumber)
    ) {
      return NextResponse.json(
        {
          error:
            'Faltan datos del destinatario. Volvé al inicio del retiro y verificá el número SINPE.',
        },
        { status: 400 }
      );
    }

    const referenceId = crypto.randomUUID().replace(/-/g, '');
    const conversion = calculateConversion(amount);
    const idSubmittedAt =
      idFrontSubmitted && idBackSubmitted ? new Date() : null;

    await prisma.withdrawal.create({
      data: {
        referenceId,
        walletAddress,
        firstName: firstName.trim(),
        lastName,
        idNumber: idNumber.trim(),
        phoneNumber: phoneNumber.trim(),
        accountNumber: accountNumber.trim(),
        amountWld: new Prisma.Decimal(amount),
        amountCrc: new Prisma.Decimal(conversion.netCrc),
        exchangeRate: new Prisma.Decimal(EXCHANGE_RATES.WLD_TO_CRC),
        commissionCrc: new Prisma.Decimal(conversion.fee),
        idFrontSubmitted,
        idBackSubmitted,
        idSubmittedAt,
        contactEmail,
        status: 'PENDING_PAYMENT',
      },
    });

    return NextResponse.json({ id: referenceId });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json(
      { error: 'Error interno. Intentá de nuevo más tarde.' },
      { status: 500 }
    );
  }
}
