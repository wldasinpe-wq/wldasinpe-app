import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawFlowTopBar } from '@/components/Navigation/WithdrawFlowTopBar';
import { InitiateWithdrawalStep } from '@/components/WithdrawSteps/InitiateWithdrawalStep';

export default async function WithdrawReviewPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <WithdrawFlowTopBar backHref="/withdraw/amount" />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <InitiateWithdrawalStep />
      </Page.Main>
    </>
  );
}
