import { client } from '../chain/client.js';
import { pairCreatedEvent, poolCreatedEvent, poolViewAbi } from '../chain/abis.js';
import { config } from '../config.js';
import { getToken, upsertPool } from '../db/repository.js';
import { enqueueAnalysis } from './analysisQueue.js';
import { publish } from '../events.js';


async function verifyPool(pool: `0x${string}`, token0: string, token1: string) {
  try {
    const [a,b,code] = await Promise.all([
      client.readContract({ address:pool, abi:poolViewAbi, functionName:'token0' }),
      client.readContract({ address:pool, abi:poolViewAbi, functionName:'token1' }),
      client.getBytecode({ address:pool })
    ]);
    return Boolean(code && code !== '0x' && a.toLowerCase() === token0.toLowerCase() && b.toLowerCase() === token1.toLowerCase());
  } catch { return false; }
}

function allowed(factory: string, protocol: 'v2'|'v3') {
  const list = protocol === 'v2' ? config.dexV2Factories : config.dexV3Factories;
  return list.length === 0 || list.includes(factory.toLowerCase());
}

export async function scanPools(blockNumber: bigint) {
  const [v2Logs, v3Logs] = await Promise.all([
    client.getLogs({ event: pairCreatedEvent, fromBlock:blockNumber, toBlock:blockNumber }).catch(() => []),
    client.getLogs({ event: poolCreatedEvent, fromBlock:blockNumber, toBlock:blockNumber }).catch(() => [])
  ]);
  for (const log of v2Logs) {
    const factory = log.address.toLowerCase(); if (!allowed(factory,'v2')) continue;
    const { token0, token1, pair } = log.args as {
      token0?: `0x${string}`;
      token1?: `0x${string}`;
      pair?: `0x${string}`;
    };
    if (!token0 || !token1 || !pair) continue;
    if (!await verifyPool(pair, token0, token1)) continue;
    const pool = { address:pair, factory, protocol:'v2' as const, token0, token1, createdBlock:Number(blockNumber), createdTx:log.transactionHash ?? null };
    upsertPool(pool); publish('pool:new', pool);
    for (const t of [token0, token1]) if (getToken(t)) enqueueAnalysis(t);
  }
  for (const log of v3Logs) {
    const factory = log.address.toLowerCase(); if (!allowed(factory,'v3')) continue;
    const { token0, token1, fee, pool } = log.args as {
      token0?: `0x${string}`;
      token1?: `0x${string}`;
      fee?: number;
      pool?: `0x${string}`;
    };
    if (!token0 || !token1 || !pool) continue;
    if (!await verifyPool(pool, token0, token1)) continue;
    const info = { address:pool, factory, protocol:'v3' as const, token0, token1, fee:Number(fee ?? 0), createdBlock:Number(blockNumber), createdTx:log.transactionHash ?? null };
    upsertPool(info); publish('pool:new', info);
    for (const t of [token0, token1]) if (getToken(t)) enqueueAnalysis(t);
  }
}
