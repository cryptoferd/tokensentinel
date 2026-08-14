import { createPublicClient, defineChain, http } from 'viem';
import { config } from '../config.js';

export const robinhoodChain = defineChain({
  id: config.CHAIN_ID,
  name: 'Robinhood Chain',
  nativeCurrency: { name: 'Ether', symbol: 'ETH', decimals: 18 },
  rpcUrls: { default: { http: [config.RPC_URL] } },
  blockExplorers: { default: { name: 'Blockscout', url: config.BLOCKSCOUT_BASE_URL } }
});

export const client = createPublicClient({
  chain: robinhoodChain,
  transport: http(config.RPC_URL, { timeout: 20_000, retryCount: 2, retryDelay: 350 }),
  batch: { multicall: true }
});
