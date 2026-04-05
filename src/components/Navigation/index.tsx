'use client';

import { TabItem, Tabs } from '@worldcoin/mini-apps-ui-kit-react';
import { Bank, Home, User } from 'iconoir-react';
import { usePathname, useRouter } from 'next/navigation';
import { useCallback, useMemo } from 'react';

/**
 * This component uses the UI Kit to navigate between pages
 * Bottom navigation is the most common navigation pattern in Mini Apps
 * We require mobile first design patterns for mini apps
 * Read More: https://docs.world.org/mini-apps/design/app-guidelines#mobile-first
 */

export const Navigation = () => {
  const pathname = usePathname() ?? '';
  const router = useRouter();

  const value = useMemo(() => {
    if (pathname.startsWith('/wallet')) return 'wallet';
    if (pathname.startsWith('/profile')) return 'profile';
    return 'home';
  }, [pathname]);

  const onValueChange = useCallback(
    (next: string) => {
      if (next === 'home') router.push('/home');
      else if (next === 'wallet') router.push('/wallet');
      else if (next === 'profile') router.push('/profile');
    },
    [router],
  );

  return (
    <Tabs value={value} onValueChange={onValueChange}>
      <TabItem value="home" icon={<Home />} label="Inicio" />
      <TabItem value="wallet" icon={<Bank />} label="Billetera" />
      <TabItem value="profile" icon={<User />} label="Perfil" />
    </Tabs>
  );
};
