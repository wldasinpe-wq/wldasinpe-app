import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WldBalancePill } from '@/components/WldBalanceDisplay';
import { InitiateWithdrawalStep } from '@/components/WithdrawSteps/InitiateWithdrawalStep';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import Link from 'next/link';

export default async function WithdrawReviewPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          startAdornment={
            <Link
              href="/withdraw/id"
              className="text-gray-900 transition-colors hover:text-gray-600"
            >
              <svg
                width="24"
                height="24"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M19 12H5M12 19l-7-7 7-7" />
              </svg>
            </Link>
          }
          endAdornment={<WldBalancePill />}
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <InitiateWithdrawalStep />
      </Page.Main>
    </>
  );
}
