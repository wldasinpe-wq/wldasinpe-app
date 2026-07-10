'use client';

import { hapticPrimary } from '@/lib/haptics';
import Link from 'next/link';
import type { ComponentProps } from 'react';

type Props = ComponentProps<typeof Link>;

export function HapticLink({ onClick, onPointerDown, ...rest }: Props) {
  return (
    <Link
      {...rest}
      onPointerDown={(e) => {
        onPointerDown?.(e);
        if (e.button !== 0) return;
        hapticPrimary();
      }}
      onClick={(e) => {
        onClick?.(e);
      }}
    />
  );
}
