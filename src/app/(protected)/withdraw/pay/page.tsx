import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawFlowTopBar } from '@/components/Navigation/WithdrawFlowTopBar';
import { PayStep } from '@/components/WithdrawSteps/PayStep';

export default async function WithdrawPayPage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <WithdrawFlowTopBar backHref="/withdraw/review" />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <PayStep />
      </Page.Main>
    </>
  );
}
