import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WldBalancePill } from '@/components/WldBalanceDisplay';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { AmountStep } from '@/components/WithdrawSteps/AmountStep';
import Link from 'next/link';

export default async function WithdrawAmountPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          startAdornment={
            <Link href="/withdraw/id" className="text-gray-900 hover:text-gray-600 transition-colors">
              <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                <path d="M19 12H5M12 19l-7-7 7-7"/>
              </svg>
            </Link>
          }
          endAdornment={<WldBalancePill />}
        />
      </Page.Header>
      <Page.Main className="flex min-h-0 flex-1 flex-col px-4 py-3 pb-8">
        <AmountStep />
      </Page.Main>
    </>
  );
}
