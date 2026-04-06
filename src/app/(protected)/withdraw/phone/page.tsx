import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { WithdrawFlowTopBar } from '@/components/Navigation/WithdrawFlowTopBar';
import { PhoneStep } from '@/components/WithdrawSteps/PhoneStep';

export default async function WithdrawPhonePage() {
  await auth();

  return (
    <>
      <Page.Header className="p-0">
        <WithdrawFlowTopBar backHref="/home" />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-6 px-6 py-6 pb-8">
        <PhoneStep />
      </Page.Main>
    </>
  );
}
