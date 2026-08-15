import { getChain, getClient, sanitizeRpcError } from '../chain/chains.js';
import { config } from '../config.js';
import { attachTokenToActiveLiveScans, attachTokenToScan, getState, latestActiveLiveEnd, setState, upsertToken } from '../db/repository.js';
import { readDeploymentMetadata } from '../analysis/analyzer.js';
import { enqueueAnalysis } from './analysisQueue.js';
import { scanPools } from './poolWatcher.js';
import { publish } from '../events.js';

let running = false;
let stopRequested = false;
let latestKnown = 0n;
let startedAt: number | null = null;
let endsAt: number | null = null;
let activeChainKey:string|null=null;

export function scannerStatus(requestedChainKey='robinhood') {
  return {
    running,
    latestKnown:Number(latestKnown),
    scanned:Number(getState(`last_scanned_block:${activeChainKey??requestedChainKey}`) ?? 0),
    startedAt,
    endsAt,chainKey:activeChainKey
  };
}
export function stopScanner() {
  if (!running) return false;
  stopRequested = true;
  publish('scanner:status', { running:false, startedAt, endsAt, stopping:true });
  return true;
}

async function initialBlock(chainKey:string,fromLatest: boolean) {
  const client=getClient(chainKey);
  const latest = await client.getBlockNumber();
  latestKnown = latest;
  if (fromLatest) return latest;
  const saved = getState(`last_scanned_block:${chainKey}`);
  if (saved) return BigInt(saved) + 1n;
  if (config.START_BLOCK === 'latest') return latest;
  const requested = BigInt(config.START_BLOCK);
  return requested > latest ? latest : requested;
}

export async function scanDeployments(chainKey:string,blockNumber: bigint, scanId?:string) {
  const client=getClient(chainKey);
  const block = await client.getBlock({ blockNumber, includeTransactions:true });
  const creations = block.transactions.filter((tx:any) => tx.to === null);
  for (const tx of creations as any[]) {
    try {
      const receipt = await client.getTransactionReceipt({ hash:tx.hash });
      const contract = receipt.contractAddress;
      if (!contract) continue;
      await recordDeployment({chainKey,contract,deployer:tx.from??null,transactionHash:tx.hash,blockNumber:Number(blockNumber),timestamp:Number(block.timestamp)*1000,scanId});
    } catch (e) {
      console.warn(`[scanner] deployment probe failed in block ${blockNumber}:`, sanitizeRpcError(e));
    }
  }
}

export async function recordDeployment(input:{chainKey:string;contract:`0x${string}`;deployer:string|null;transactionHash:string;blockNumber:number;timestamp:number;scanId?:string}) {
  const chain=getChain(input.chainKey);const meta=await readDeploymentMetadata(input.chainKey,input.contract); if(!meta)return false;
  const record={chainKey:chain.key,chainId:chain.id,chainName:chain.name,explorerUrl:chain.explorerUrl,address:input.contract.toLowerCase(),assetType:meta.assetType,name:meta.name,symbol:meta.symbol,decimals:meta.decimals,totalSupply:meta.totalSupply?.toString()??null,deployer:input.deployer?.toLowerCase()??null,
    deploymentTx:input.transactionHash,deploymentBlock:input.blockNumber,firstSeenAt:input.timestamp,analysisState:'queued' as const,riskScore:0,riskLabel:'LOW' as const,warnings:[],bytecodeFlags:[],topHolders:[],poolCreated:false,pools:[],verified:null,sourceAvailable:null,
    owner:null,ownershipRenounced:null,buyTax:null,sellTax:null,top5Percent:null,circulatingTop5Percent:null,holderCountEstimate:null,marketCapUsd:null,liquidityUsd:null,openSeaSlug:null,updatedAt:Date.now()};
  upsertToken(record); if(input.scanId)attachTokenToScan(input.scanId,input.contract);else attachTokenToActiveLiveScans(input.chainKey,input.contract);
  publish('token:new',record);enqueueAnalysis(input.chainKey,input.contract);return true;
}

async function scanOne(chainKey:string,blockNumber: bigint) {
  await Promise.all([scanDeployments(chainKey,blockNumber), scanPools(chainKey,blockNumber)]);
  setState(`last_scanned_block:${chainKey}`, blockNumber.toString());
  publish('block', { chainKey,number:Number(blockNumber) });
}

export async function runScanner(options: { chainKey?:string;durationMinutes?: number; fromLatest?: boolean } = {}) {
  const chainKey=options.chainKey??'robinhood';const client=getClient(chainKey);
  if (running) { if(activeChainKey!==chainKey)throw new Error(`Scanner is already monitoring ${getChain(activeChainKey!).name}.`);const activeEnd=latestActiveLiveEnd(chainKey); if (activeEnd && (!endsAt || activeEnd>endsAt)) endsAt=activeEnd; return false; }
  running = true; stopRequested = false;
  activeChainKey=chainKey;
  startedAt = Date.now();
  endsAt = options.durationMinutes ? startedAt + options.durationMinutes * 60_000 : null;
  publish('scanner:status', { running:true, startedAt, endsAt });
  let completed = false;
  try {
    let next = await initialBlock(chainKey,options.fromLatest ?? true);
    console.log(`[scanner] ${chainKey} starting at block ${next}`);
    while (!stopRequested) {
      const activeEnd=latestActiveLiveEnd(chainKey);
      if (activeEnd && (!endsAt || activeEnd>endsAt)) endsAt=activeEnd;
      if (endsAt !== null && Date.now()>=endsAt) break;
      try {
        const tip = await client.getBlockNumber(); latestKnown = tip;
        const target = tip - BigInt(config.CONFIRMATIONS);
        let count = 0;
        while (next <= target && count < config.MAX_BLOCKS_PER_TICK && !stopRequested) {
          await scanOne(chainKey,next); next++; count++;
        }
      } catch (e) {
        console.error('[scanner] tick error:', sanitizeRpcError(e));
      }
      await new Promise(r => setTimeout(r, config.POLL_INTERVAL_MS));
    }
    completed = !stopRequested;
    return true;
  } finally {
    running = false;
    const stoppedAt = Date.now();
    startedAt = null;
    endsAt = null;
    activeChainKey=null;
    stopRequested = false;
    publish('scanner:status', { running:false, stoppedAt, completed });
    console.log('[scanner] stopped');
  }
}
