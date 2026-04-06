import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawFlowTopBar } from '@/components/Navigation/WithdrawFlowTopBar';
import { AmountStep } from '@/components/WithdrawSteps/AmountStep';

export default async function WithdrawAmountPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <WithdrawFlowTopBar backHref="/withdraw/email" />
      </Page.Header>
      <Page.Main className="flex min-h-0 flex-1 flex-col px-4 py-3 pb-8">
        <AmountStep />
      </Page.Main>
    </>
  );
}
