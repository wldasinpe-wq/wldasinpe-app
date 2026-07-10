'use client';

import { hapticPrimary } from '@/lib/haptics';
import { Button } from '@worldcoin/mini-apps-ui-kit-react';
import Link from 'next/link';

export function HomeWithdrawCta() {
  return (
    <Link
      href="/withdraw/phone"
      className="block w-full"
      onClick={() => hapticPrimary()}
    >
      <Button
        size="lg"
        variant="primary"
        className="w-full text-base font-medium tracking-wide rounded-sm shadow"
      >
        Iniciar retiro
      </Button>
    </Link>
  );
}
