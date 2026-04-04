'use client';

import { Page } from '@/components/PageLayout';
import { usePathname } from 'next/navigation';
import { Navigation } from '@/components/Navigation';

/**
 * Bottom tabs are fixed and sit on top of the content box. Multi-step flows
 * (e.g. withdraw) need full vertical space for primary actions — hide tabs there.
 */
export function ConditionalFixedNavigation() {
  const pathname = usePathname();
  if (pathname?.startsWith('/withdraw')) {
    return null;
  }

  return (
    <Page.Footer
      className="fixed bottom-0 z-40 w-full px-0"
      style={{ background: 'var(--white-ridivi)' }}
    >
      <Navigation />
    </Page.Footer>
  );
}
