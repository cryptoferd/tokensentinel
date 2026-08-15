import pLimit from 'p-limit';
import { config } from '../config.js';
import { getChain, getClient } from '../chain/chains.js';
import { updateScanSession } from '../db/repository.js';
import { recordDeployment } from './blockScanner.js';

const active=new Set<string>();

async function firstBlockAtOrAfter(chainKey:string,cutoffSeconds:bigint,tip:bigint) {
  const client=getClient(chainKey);let low=0n,high=tip;
  while(low<high){
    const mid=(low+high)/2n;
    const block=await client.getBlock({blockNumber:mid});
    if(block.timestamp<cutoffSeconds)low=mid+1n;else high=mid;
  }
  return low;
}

export async function runHistoricalScan(scanId:string,chainKey:string,lookbackMinutes:number) {
  if(active.has(scanId))return;active.add(scanId);
  const client=getClient(chainKey);const chain=getChain(chainKey);
  try{
    const tip=await client.getBlockNumber();
    const cutoffSeconds=BigInt(Math.floor((Date.now()-lookbackMinutes*60_000)/1000));
    const from=await firstBlockAtOrAfter(chainKey,cutoffSeconds,tip);
    const total=Number(tip-from+1n);
    if(total>config.MAX_HISTORICAL_BLOCKS)throw new Error(`${chain.name} produced ${total.toLocaleString()} blocks in this window, above the ${config.MAX_HISTORICAL_BLOCKS.toLocaleString()} block safety limit.`);
    updateScanSession(scanId,{fromBlock:Number(from),toBlock:Number(tip),scannedBlocks:0,totalBlocks:total});
    const limit=pLimit(config.HISTORICAL_CONCURRENCY);const probeLimit=pLimit(config.HISTORICAL_CONCURRENCY);let processed=0;
    const batchSize=Math.max(20,config.HISTORICAL_CONCURRENCY*5);
    for(let cursor=from;cursor<=tip;cursor+=BigInt(batchSize)){
      const end=cursor+BigInt(batchSize-1)>tip?tip:cursor+BigInt(batchSize-1);
      const numbers:Array<bigint>=[];for(let block=cursor;block<=end;block++)numbers.push(block);
      await Promise.all(numbers.map(blockNumber=>limit(async()=>{
        const block=await client.getBlock({blockNumber,includeTransactions:true});
        const creations=block.transactions.filter((tx:any)=>tx.to===null);
        await Promise.all(creations.map((tx:any)=>probeLimit(async()=>{
          try{
            const receipt=await client.getTransactionReceipt({hash:tx.hash});
            if(!receipt.contractAddress)return;
            await recordDeployment({chainKey,contract:receipt.contractAddress,deployer:tx.from??null,transactionHash:tx.hash,blockNumber:Number(blockNumber),timestamp:Number(block.timestamp)*1000,scanId});
          }catch(error){console.warn(`[history:${chainKey}] skipped creation ${tx.hash}:`,error instanceof Error?error.message:error);}
        })));
        processed++;if(processed%10===0||processed===total)updateScanSession(scanId,{scannedBlocks:processed});
      })));
    }
    updateScanSession(scanId,{status:'complete',completedAt:Date.now(),scannedBlocks:total,totalBlocks:total});
  }catch(error){const message=error instanceof Error?error.message:String(error);console.error(`[history:${chainKey}] ${scanId} failed:`,message);updateScanSession(scanId,{status:'failed',completedAt:Date.now(),error:message});}
  finally{active.delete(scanId);}
}
