import { Home } from 'iconoir-react';
import { WldBalancePill } from '@/components/WldBalanceDisplay';
import { HapticLink } from '@/components/HapticLink';

function BackChevron() {
  return (
    <svg
      width="24"
      height="24"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden
    >
      <path d="M19 12H5M12 19l-7-7 7-7" />
    </svg>
  );
}

type Props = {
  backHref: string;
};

/**
 * Withdraw screens: back (left), home (visually centered), balance (right).
 * Matches mini-app TopBar height/padding (`h-18`, `px-6 pt-6 pb-2`).
 */
export function WithdrawFlowTopBar({ backHref }: Props) {
  return (
    <div className="relative flex h-18 w-full items-center px-6 pt-6 pb-2">
      <div className="relative z-10 flex min-w-0 flex-1 justify-start">
        <HapticLink
          href={backHref}
          className="text-gray-900 transition-colors hover:text-gray-600"
          aria-label="Atrás"
        >
          <BackChevron />
        </HapticLink>
      </div>

      <div className="pointer-events-none absolute inset-0 flex items-center justify-center">
        <span className="pointer-events-auto">
          <HapticLink
            href="/home"
            className="text-gray-900 transition-colors hover:text-gray-600"
            aria-label="Inicio"
          >
            <Home width={24} height={24} strokeWidth={2} />
          </HapticLink>
        </span>
      </div>

      <div className="relative z-10 flex min-w-0 flex-1 justify-end">
        <WldBalancePill />
      </div>
    </div>
  );
}
