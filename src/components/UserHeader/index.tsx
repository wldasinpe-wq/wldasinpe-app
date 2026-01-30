'use client';
import { Marble } from '@worldcoin/mini-apps-ui-kit-react';
import { useState } from 'react';

interface UserHeaderProps {
  username?: string;
  walletAddress?: string;
  profilePictureUrl?: string;
}

export const UserHeader = ({
  username,
  walletAddress,
  profilePictureUrl,
}: UserHeaderProps) => {
  const [copied, setCopied] = useState(false);

  const handleCopyAddress = async () => {
    if (!walletAddress) return;

    try {
      await navigator.clipboard.writeText(walletAddress);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch (error) {
      console.error('Failed to copy address:', error);
    }
  };

  return (
    <div className="flex items-center gap-2">
      <div className="flex flex-col items-end gap-0.5">
        <p className="text-sm font-semibold capitalize">{username}</p>
        {walletAddress && (
          <button
            onClick={handleCopyAddress}
            className="text-xs text-gray-500 font-mono hover:text-gray-700 cursor-pointer transition-colors"
            title="Click to copy full address"
          >
            {copied ? (
              <span className="text-green-600">✓ Copied!</span>
            ) : (
              <span>
                {walletAddress.slice(0, 6)}...{walletAddress.slice(-4)}
              </span>
            )}
          </button>
        )}
      </div>
      <Marble src={profilePictureUrl} className="w-12" />
    </div>
  );
};
