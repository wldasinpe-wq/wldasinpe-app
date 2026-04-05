import {
  createPublicClient,
  erc20Abi,
  fallback,
  formatUnits,
  getAddress,
  http,
} from 'viem';
import { worldchain } from 'viem/chains';

const DECIMALS = 18;

/** WLD ERC-20 on World Chain mainnet (address book), EIP-55 checksummed. */
const WLD_WORLDCHAIN_DEFAULT =
  '0x2cFc85d8E48F8EAB294be644d9E25C3030863003' as const;

/** Public RPCs — Thirdweb/dRPC first; Alchemy `/public` often rate-limits server IPs. */
const WORLDCHAIN_PUBLIC_RPCS: readonly string[] = [
  'https://480.rpc.thirdweb.com',
  'https://worldchain.drpc.org',
  'https://worldchain-mainnet.g.alchemy.com/public',
];

function getWldTokenAddress(): `0x${string}` {
  const fromEnv = process.env.NEXT_PUBLIC_WLD_TOKEN_ADDRESS;
  if (
    typeof fromEnv === 'string' &&
    /^0x[a-fA-F0-9]{40}$/i.test(fromEnv)
  ) {
    return getAddress(fromEnv) as `0x${string}`;
  }
  return getAddress(WLD_WORLDCHAIN_DEFAULT) as `0x${string}`;
}

function worldchainRpcUrlList(): string[] {
  const custom = process.env.WORLDCHAIN_RPC_URL;
  const ordered: string[] = [];
  if (typeof custom === 'string' && custom.startsWith('http')) {
    ordered.push(custom);
  }
  for (const u of WORLDCHAIN_PUBLIC_RPCS) {
    if (!ordered.includes(u)) ordered.push(u);
  }
  return ordered;
}

function worldchainReadTransport() {
  const urls = worldchainRpcUrlList();
  const transports = urls.map((url) =>
    http(url, { timeout: 20_000, retryCount: 1 }),
  );
  return fallback(transports, { retryCount: 0 });
}

export async function readWldBalanceWei(
  walletAddress: `0x${string}`,
): Promise<bigint> {
  const client = createPublicClient({
    chain: worldchain,
    transport: worldchainReadTransport(),
  });
  const owner = getAddress(walletAddress);
  return client.readContract({
    address: getWldTokenAddress(),
    abi: erc20Abi,
    functionName: 'balanceOf',
    args: [owner],
  });
}

/** Decimal string for the keypad; trims trailing zeros after the point. */
export function wldWeiToKeypadAmount(wei: bigint): string {
  let s = formatUnits(wei, DECIMALS);
  if (!s.includes('.')) return s;
  s = s.replace(/\.?0+$/, '');
  return s === '' ? '0' : s;
}

export function wldWeiToNumber(wei: bigint): number {
  return Number(formatUnits(wei, DECIMALS));
}
