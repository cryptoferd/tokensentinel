import { client } from '../chain/client.js';
import { config } from '../config.js';
import { getState, setState, upsertToken } from '../db/repository.js';
import { readErc20Metadata } from '../analysis/analyzer.js';
import { enqueueAnalysis } from './analysisQueue.js';
import { scanPools } from './poolWatcher.js';
import { publish } from '../events.js';

let running = false;
let stopRequested = false;
let latestKnown = 0n;

export function scannerStatus() { return { running, latestKnown:Number(latestKnown), scanned:Number(getState('last_scanned_block') ?? 0) }; }
export function stopScanner() { stopRequested = true; }

async function initialBlock() {
  const saved = getState('last_scanned_block');
  if (saved) return BigInt(saved) + 1n;
  const latest = await client.getBlockNumber();
  if (config.START_BLOCK === 'latest') return latest;
  const requested = BigInt(config.START_BLOCK);
  return requested > latest ? latest : requested;
}

async function scanDeployments(blockNumber: bigint) {
  const block = await client.getBlock({ blockNumber, includeTransactions:true });
  const creations = block.transactions.filter((tx:any) => tx.to === null);
  for (const tx of creations as any[]) {
    try {
      const receipt = await client.getTransactionReceipt({ hash:tx.hash });
      const contract = receipt.contractAddress;
      if (!contract) continue;
      const meta = await readErc20Metadata(contract);
      if (!meta) continue;
      const record = {
        address:contract.toLowerCase(), name:meta.name, symbol:meta.symbol, decimals:meta.decimals, totalSupply:meta.totalSupply.toString(),
        deployer:tx.from?.toLowerCase() ?? null, deploymentTx:tx.hash, deploymentBlock:Number(blockNumber), firstSeenAt:Date.now(), analysisState:'queued' as const,
        riskScore:0, riskLabel:'LOW' as const, warnings:[], bytecodeFlags:[], topHolders:[], poolCreated:false, pools:[], verified:null, sourceAvailable:null,
        owner:null, ownershipRenounced:null, buyTax:null, sellTax:null, top5Percent:null, circulatingTop5Percent:null, holderCountEstimate:null, updatedAt:Date.now()
      };
      upsertToken(record); publish('token:new', record); enqueueAnalysis(contract);
    } catch (e) {
      console.warn(`[scanner] deployment probe failed in block ${blockNumber}:`, e instanceof Error ? e.message : e);
    }
  }
}

async function scanOne(blockNumber: bigint) {
  await Promise.all([scanDeployments(blockNumber), scanPools(blockNumber)]);
  setState('last_scanned_block', blockNumber.toString());
  publish('block', { number:Number(blockNumber) });
}

export async function runScanner() {
  if (running) return;
  running = true; stopRequested = false;
  let next = await initialBlock();
  console.log(`[scanner] starting at block ${next}`);
  while (!stopRequested) {
    try {
      const tip = await client.getBlockNumber(); latestKnown = tip;
      const target = tip - BigInt(config.CONFIRMATIONS);
      let count = 0;
      while (next <= target && count < config.MAX_BLOCKS_PER_TICK && !stopRequested) {
        await scanOne(next); next++; count++;
      }
    } catch (e) {
      console.error('[scanner] tick error:', e instanceof Error ? e.message : e);
    }
    await new Promise(r => setTimeout(r, config.POLL_INTERVAL_MS));
  }
  running = false;
  console.log('[scanner] stopped');
}
