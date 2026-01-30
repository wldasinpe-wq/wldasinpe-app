'use client';
import { CircularIcon, Marble } from '@worldcoin/mini-apps-ui-kit-react';
import { CheckCircleSolid } from 'iconoir-react';
import { useSession } from 'next-auth/react';
import { useState } from 'react';

/**
 * Minikit is only available on client side. Thus user info needs to be rendered on client side.
 * UserInfo component displays user information including profile picture, username, and verification status.
 * It uses the Marble component from the mini-apps-ui-kit-react library to display the profile picture.
 * The component is client-side rendered.
 */
export const UserInfo = () => {
  // Fetching the user state client side
  const session = useSession();
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!session?.data?.user?.walletAddress) return;

    try {
      await navigator.clipboard.writeText(session.data.user.walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className="flex flex-row items-center justify-start gap-4 rounded-xl w-full border-2 border-gray-200 p-4">
      <Marble src={session?.data?.user?.profilePictureUrl} className="w-14" />
      <div className="flex flex-col items-start justify-center gap-1">
        <div className="flex flex-row items-center justify-center">
          <span className="text-lg font-semibold capitalize">
            {session?.data?.user?.username}
          </span>
          {session?.data?.user?.profilePictureUrl && (
            <CircularIcon size="sm" className="ml-0">
              <CheckCircleSolid className="text-blue-600" />
            </CircularIcon>
          )}
        </div>
        {session?.data?.user?.walletAddress && (
          <button
            onClick={handleCopyAddress}
            className="text-xs text-gray-500 font-mono hover:text-gray-700 cursor-pointer transition-colors"
            title="Click to copy full address"
          >
            {copied ? (
              <span className="text-green-600">✓ Copied!</span>
            ) : (
              <span>
                {session.data.user.walletAddress.slice(0, 6)}...{session.data.user.walletAddress.slice(-4)}
              </span>
            )}
          </button>
        )}
      </div>
    </div>
  );
};
