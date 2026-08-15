import pLimit from 'p-limit';
import { getAddress } from 'viem';
import { config } from '../config.js';
import { updateScanSession } from '../db/repository.js';
import { recordDeployment } from './blockScanner.js';

interface ExplorerTransaction {
  hash:string;
  block_number:number;
  timestamp:string;
  from?:{hash?:string}|null;
  created_contract?:{hash?:string}|null;
}
interface TransactionPage { items?:ExplorerTransaction[]; next_page_params?:Record<string,string|number|null>|null }
const active=new Set<string>();
const wait=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));

async function fetchPage(url:URL) {
  let lastError:unknown;
  for(let attempt=1;attempt<=3;attempt++){
    try{
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(45_000)});
      if(response.ok)return await response.json() as TransactionPage;
      if(response.status<500&&response.status!==429)throw new Error(`Blockscout historical feed returned ${response.status}`);
      lastError=new Error(`Blockscout historical feed returned ${response.status}`);
    }catch(error){lastError=error;}
    if(attempt<3)await wait(attempt*1_000);
  }
  throw lastError instanceof Error?lastError:new Error('Blockscout historical feed is temporarily unavailable');
}

export async function runHistoricalScan(scanId:string,lookbackMinutes:number) {
  if(active.has(scanId))return; active.add(scanId);
  const cutoff=Date.now()-lookbackMinutes*60_000; let processed=0, newestBlock:number|null=null,oldestBlock:number|null=null;
  try{
    let pageParams:Record<string,string|number|null>|null={filter:'validated'};
    const limit=pLimit(config.HISTORICAL_CONCURRENCY);
    while(pageParams){
      const url=new URL('/api/v2/transactions',config.BLOCKSCOUT_BASE_URL);
      url.searchParams.set('filter','validated');
      for(const [key,value] of Object.entries(pageParams))if(value!=null)url.searchParams.set(key,String(value));
      const page=await fetchPage(url); const items=page.items??[]; if(!items.length)break;
      const inWindow=items.filter(item=>Number.isFinite(Date.parse(item.timestamp))&&Date.parse(item.timestamp)>=cutoff);
      if(inWindow.length){
        newestBlock=newestBlock??inWindow[0].block_number; oldestBlock=inWindow[inWindow.length-1].block_number;
        await Promise.all(inWindow.filter(item=>item.created_contract?.hash).map(item=>limit(async()=>{
          try { await recordDeployment({contract:getAddress(item.created_contract!.hash!) as `0x${string}`,deployer:item.from?.hash??null,transactionHash:item.hash,blockNumber:item.block_number,timestamp:Date.parse(item.timestamp),scanId}); }
          catch(error){console.warn(`[history] skipped malformed/unavailable creation ${item.hash}:`,error instanceof Error?error.message:error);}
        })));
      }
      processed+=items.length;
      updateScanSession(scanId,{scannedBlocks:processed,fromBlock:oldestBlock??undefined,toBlock:newestBlock??undefined});
      if(processed>=config.MAX_HISTORICAL_TRANSACTIONS)throw new Error(`Historical safety limit reached after ${processed.toLocaleString()} transactions. Increase MAX_HISTORICAL_TRANSACTIONS on Railway for this window.`);
      if(inWindow.length<items.length)break;
      pageParams=page.next_page_params??null;
    }
    updateScanSession(scanId,{status:'complete',completedAt:Date.now(),scannedBlocks:processed,totalBlocks:processed,fromBlock:oldestBlock??undefined,toBlock:newestBlock??undefined});
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error(`[history] ${scanId} failed:`,message);updateScanSession(scanId,{status:'failed',completedAt:Date.now(),error:message});}
  finally{active.delete(scanId);}
}
