import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WldBalancePill } from '@/components/WldBalanceDisplay';
import { EmailStep } from '@/components/WithdrawSteps/EmailStep';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';
import { HapticLink } from '@/components/HapticLink';

export default async function WithdrawEmailPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          startAdornment={
            <HapticLink
              href="/withdraw/confirm"
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
            </HapticLink>
          }
          endAdornment={<WldBalancePill />}
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <EmailStep />
      </Page.Main>
    </>
  );
}
