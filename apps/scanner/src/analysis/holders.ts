import type { Holder } from '@sentinel/shared';
import { zeroAddress } from 'viem';
import { getClient } from '../chain/chains.js';
import { transferEvent } from '../chain/abis.js';
import { config } from '../config.js';

const DEAD = '0x000000000000000000000000000000000000dead';

export async function analyzeHolders(chainKey:string,token: `0x${string}`, deploymentBlock: bigint, latestBlock: bigint, totalSupply: bigint, poolAddresses: string[]) {
  const client=getClient(chainKey);
  const balances = new Map<string, bigint>();
  const fromBlock = deploymentBlock > BigInt(config.HOLDER_LOOKBACK_BLOCKS) && deploymentBlock < latestBlock - BigInt(config.HOLDER_LOOKBACK_BLOCKS)
    ? latestBlock - BigInt(config.HOLDER_LOOKBACK_BLOCKS) : deploymentBlock;
  let truncated = fromBlock !== deploymentBlock;
  let logCount = 0;
  const chunk = 2000n;
  for (let start = fromBlock; start <= latestBlock; start += chunk + 1n) {
    const end = start + chunk > latestBlock ? latestBlock : start + chunk;
    const logs = await client.getLogs({ address: token, event: transferEvent, fromBlock: start, toBlock: end });
    for (const log of logs) {
      logCount++;
      if (logCount > config.MAX_TRANSFER_LOGS) { truncated = true; break; }
      const { from, to, value } = log.args;
      if (!from || !to || value == null) continue;
      const f = from.toLowerCase(), t = to.toLowerCase();
      if (f !== zeroAddress) balances.set(f, (balances.get(f) ?? 0n) - value);
      if (t !== zeroAddress) balances.set(t, (balances.get(t) ?? 0n) + value);
    }
    if (logCount > config.MAX_TRANSFER_LOGS) break;
  }
  const excluded = new Set([zeroAddress.toLowerCase(), DEAD, token.toLowerCase(), ...poolAddresses.map(x => x.toLowerCase())]);
  const live = [...balances.entries()].filter(([,v]) => v > 0n).sort((a,b) => a[1] === b[1] ? 0 : a[1] > b[1] ? -1 : 1);
  const denom = totalSupply > 0n ? totalSupply : live.reduce((a,[,b]) => a+b, 0n);
  const pct = (v: bigint, d: bigint) => d > 0n ? Number((v * 1_000_000n) / d) / 10_000 : 0;
  const topRaw = live.slice(0,5);
  const circulating = live.filter(([a]) => !excluded.has(a));
  const circulatingSupply = circulating.reduce((a,[,b]) => a+b, 0n);
  const topCirc = circulating.slice(0,5);
  const holders: Holder[] = live.slice(0,10).map(([address,balance]) => ({
    address, balance: balance.toString(), percent: pct(balance, denom), excluded: excluded.has(address),
    label: address === DEAD ? 'Burn' : poolAddresses.map(x=>x.toLowerCase()).includes(address) ? 'Liquidity pool' : null
  }));
  return {
    top5Percent: topRaw.reduce((s,[,v]) => s + pct(v, denom),0),
    circulatingTop5Percent: topCirc.reduce((s,[,v]) => s + pct(v, circulatingSupply),0),
    holderCountEstimate: live.length,
    holders,
    truncated,
    logCount
  };
}
