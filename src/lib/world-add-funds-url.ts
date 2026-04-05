/**
 * World "Add Money" quick action (bridge / on-ramps into World Wallet).
 * @see https://docs.world.org/mini-apps/sharing/add-money-qa
 */
const WORLD_ADD_MONEY_APP_ID =
  'app_e7d27c5ce2234e00558776f227f791ef' as const;

/** WLD on World Chain mainnet (same default as `wld-onchain`). */
const WLD_TOKEN_DEFAULT =
  '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' as const;

function publicWldTokenAddress(): string {
  const fromEnv =
    typeof process.env.NEXT_PUBLIC_WLD_TOKEN_ADDRESS === 'string'
      ? process.env.NEXT_PUBLIC_WLD_TOKEN_ADDRESS.trim()
      : '';
  if (/^0x[a-fA-F0-9]{40}$/i.test(fromEnv)) {
    return fromEnv;
  }
  return WLD_TOKEN_DEFAULT;
}

/**
 * Opens the official Add Money mini app prefilled for WLD → this wallet.
 * Returns `null` if `NEXT_PUBLIC_APP_ID` is missing (button should stay disabled).
 */
export function buildWorldAddWldFundsUrl(input: {
  recipientAddress: string;
  /** Path in this mini app after returning (e.g. `/wallet`). */
  returnPath: string;
}): string | null {
  const sourceAppId = process.env.NEXT_PUBLIC_APP_ID?.trim();
  if (!sourceAppId) return null;

  const path =
    input.returnPath.startsWith('/')
      ? input.returnPath
      : `/${input.returnPath}`;

  const u = new URL('https://world.org/mini-app');
  u.searchParams.set('app_id', WORLD_ADD_MONEY_APP_ID);
  u.searchParams.set('path', '/bridge');
  u.searchParams.set('toAddress', input.recipientAddress);
  u.searchParams.set('toToken', publicWldTokenAddress());
  u.searchParams.set('sourceAppId', sourceAppId);
  u.searchParams.set('sourceAppName', 'WLD a SINPE');
  u.searchParams.set('sourceDeeplinkPath', path);
  return u.toString();
}
