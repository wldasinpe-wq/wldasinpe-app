import { auth } from '@/auth';
import { ConditionalFixedNavigation } from '@/components/Navigation/ConditionalFixedNavigation';
import { Page } from '@/components/PageLayout';
import { WldBalanceProvider } from '@/components/WldBalanceDisplay';

export default async function TabsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();

  // If the user is not authenticated, redirect to the login page
  if (!session) {
    console.log('Not authenticated');
    // redirect('/');
  }

  return (
    <Page>
      <WldBalanceProvider>{children}</WldBalanceProvider>
      <ConditionalFixedNavigation />
    </Page>
  );
}
