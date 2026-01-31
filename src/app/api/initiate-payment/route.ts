import { NextRequest, NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function POST(req: NextRequest) {
  const session = await auth();

  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { phoneNumber, amountWLD } = await req.json();

    if (!phoneNumber) {
      return NextResponse.json(
        { error: 'Phone number is required' },
        { status: 400 }
      );
    }

    if (!amountWLD || parseFloat(amountWLD) < 0.1) {
      return NextResponse.json(
        { error: 'Amount must be at least 0.1 WLD' },
        { status: 400 }
      );
    }

    const uuid = crypto.randomUUID().replace(/-/g, '');

    // TODO: Store the payment data in your database
    // Example structure:
    // await db.payment.create({
    //   data: {
    //     referenceId: uuid,
    //     walletAddress: session.user.walletAddress,
    //     username: session.user.username,
    //     phoneNumber: phoneNumber.trim(),
    //     amountWLD: parseFloat(amountWLD),
    //     status: 'pending',
    //     timestamp: new Date(),
    //   },
    // });

    return NextResponse.json({ id: uuid });
  } catch (error) {
    console.error('Error initiating payment:', error);
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    );
  }
}
