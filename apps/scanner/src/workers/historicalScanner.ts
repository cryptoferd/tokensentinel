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
      const response=await fetch(url,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(20_000)});
      if(!response.ok)throw new Error(`Blockscout historical feed returned ${response.status}`);
      const page=await response.json() as TransactionPage; const items=page.items??[]; if(!items.length)break;
      const inWindow=items.filter(item=>Date.parse(item.timestamp)>=cutoff);
      if(inWindow.length){
        newestBlock=newestBlock??inWindow[0].block_number; oldestBlock=inWindow[inWindow.length-1].block_number;
        await Promise.all(inWindow.filter(item=>item.created_contract?.hash).map(item=>limit(async()=>recordDeployment({
          contract:getAddress(item.created_contract!.hash!) as `0x${string}`,deployer:item.from?.hash??null,transactionHash:item.hash,blockNumber:item.block_number,timestamp:Date.parse(item.timestamp),scanId
        }))));
      }
      processed+=items.length;
      updateScanSession(scanId,{scannedBlocks:processed,fromBlock:oldestBlock??undefined,toBlock:newestBlock??undefined});
      if(processed>=config.MAX_HISTORICAL_TRANSACTIONS)throw new Error(`Historical safety limit reached after ${processed.toLocaleString()} transactions. Increase MAX_HISTORICAL_TRANSACTIONS on Railway for this window.`);
      if(inWindow.length<items.length)break;
      pageParams=page.next_page_params??null;
    }
    updateScanSession(scanId,{status:'complete',completedAt:Date.now(),scannedBlocks:processed,totalBlocks:processed,fromBlock:oldestBlock??undefined,toBlock:newestBlock??undefined});
  }catch(error){updateScanSession(scanId,{status:'failed',completedAt:Date.now(),error:error instanceof Error?error.message:String(error)});}
  finally{active.delete(scanId);}
}
