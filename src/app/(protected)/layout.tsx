import { auth } from '@/auth';
import { ConditionalFixedNavigation } from '@/components/Navigation/ConditionalFixedNavigation';
import { Page } from '@/components/PageLayout';
import { WldBalanceProvider } from '@/components/WldBalanceDisplay';
import { redirect } from 'next/navigation';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session) {
    redirect('/');
  }

  return (
    <Page>
      <WldBalanceProvider>{children}</WldBalanceProvider>
      <ConditionalFixedNavigation />
    </Page>
  );
}
