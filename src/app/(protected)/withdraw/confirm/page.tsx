import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawFlowTopBar } from '@/components/Navigation/WithdrawFlowTopBar';
import { ConfirmStep } from '@/components/WithdrawSteps/ConfirmStep';

export default async function WithdrawConfirmPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <WithdrawFlowTopBar backHref="/withdraw/phone" />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <ConfirmStep />
      </Page.Main>
    </>
  );
}
