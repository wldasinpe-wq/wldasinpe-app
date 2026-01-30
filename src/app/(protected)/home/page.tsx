import { auth } from '@/auth';
import { Page } from '@/components/PageLayout';
import { Pay } from '@/components/Pay';
import { UserHeader } from '@/components/UserHeader';
import { UserInfo } from '@/components/UserInfo';
import { Verify } from '@/components/Verify';
import { TopBar } from '@worldcoin/mini-apps-ui-kit-react';

export default async function Home() {
  const session = await auth();

  return (
    <>
      <Page.Header className="p-0">
        <TopBar
          title="Home"
          endAdornment={
            <UserHeader
              username={session?.user.username}
              walletAddress={session?.user.walletAddress}
              profilePictureUrl={session?.user.profilePictureUrl}
            />
          }
        />
      </Page.Header>
      <Page.Main className="flex flex-col items-center justify-start gap-4 mb-16">
        <UserInfo />
        <Verify />
        <Pay />
      </Page.Main>
    </>
  );
}
