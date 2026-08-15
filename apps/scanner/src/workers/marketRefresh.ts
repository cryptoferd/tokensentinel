import pLimit from 'p-limit';
import type { TokenRecord } from '@sentinel/shared';
import { getMarketData } from '../analysis/marketData.js';
import { getToken, updateToken, upsertPool } from '../db/repository.js';
import { publish } from '../events.js';

const limit=pLimit(3);
const queued=new Set<string>();
const lastAttempt=new Map<string,number>();
const RETRY_MS=30_000;
const MAX_TOKEN_AGE_MS=24*60*60_000;

export function enqueueMarketRefresh(token:TokenRecord) {
  if(token.assetType!=='ERC20')return;
  const address=token.address.toLowerCase(); const now=Date.now();
  if(now-token.firstSeenAt>MAX_TOKEN_AGE_MS)return;
  if(token.marketCapUsd!=null&&token.liquidityUsd!=null&&token.poolCreated)return;
  if(queued.has(address)||now-(lastAttempt.get(address)??0)<RETRY_MS)return;
  queued.add(address);lastAttempt.set(address,now);
  void limit(async()=>{
    try{
      const market=await getMarketData(address);
      if(market.pair)upsertPool({...market.pair,factory:null,fee:null,createdBlock:null,createdTx:null});
      if(market.marketCapUsd!=null||market.liquidityUsd!=null||market.pair){
        updateToken(address,{marketCapUsd:market.marketCapUsd,liquidityUsd:market.liquidityUsd,updatedAt:Date.now()});
        publish('token:update',getToken(address));
      }
    }catch(error){console.warn(`[market] refresh failed for ${address}:`,error instanceof Error?error.message:error);}
    finally{queued.delete(address);}
  });
}
