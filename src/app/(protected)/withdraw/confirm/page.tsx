import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { UserHeader } from '@/components/UserHeader';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { ConfirmStep } from '@/components/WithdrawSteps/ConfirmStep';
import Link from 'next/link';

export default async function WithdrawConfirmPage() {
  const session = await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          startAdornment={
            <Link href="/withdraw/phone" className="text-gray-900 hover:text-gray-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </Link>
          }
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 mb-16">
        <ConfirmStep />
      </Page.Main>
    </>
  );
}
