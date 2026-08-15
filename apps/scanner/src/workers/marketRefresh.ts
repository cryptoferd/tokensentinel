import pLimit from 'p-limit';
import type { TokenRecord } from '@sentinel/shared';
import { getMarketData } from '../analysis/marketData.js';
import { getToken, updateToken, upsertPool } from '../db/repository.js';
import { publish } from '../events.js';
import { sanitizeRpcError } from '../chain/chains.js';

const limit=pLimit(3);
const queued=new Set<string>();
const lastAttempt=new Map<string,number>();
const RETRY_MS=30_000;
const MAX_TOKEN_AGE_MS=24*60*60_000;

export function enqueueMarketRefresh(token:TokenRecord) {
  if(token.assetType!=='ERC20')return;
  const address=token.address.toLowerCase(); const key=`${token.chainKey}:${address}`;const now=Date.now();
  if(now-token.firstSeenAt>MAX_TOKEN_AGE_MS)return;
  if(token.marketCapUsd!=null&&token.liquidityUsd!=null&&token.poolCreated)return;
  if(queued.has(key)||now-(lastAttempt.get(key)??0)<RETRY_MS)return;
  queued.add(key);lastAttempt.set(key,now);
  void limit(async()=>{
    try{
      const market=await getMarketData(token.chainKey,address);
      if(market.pair)upsertPool(token.chainKey,{...market.pair,factory:null,fee:null,createdBlock:null,createdTx:null});
      if(market.marketCapUsd!=null||market.liquidityUsd!=null||market.pair){
        updateToken(token.chainKey,address,{marketCapUsd:market.marketCapUsd,liquidityUsd:market.liquidityUsd,updatedAt:Date.now()});
        publish('token:update',getToken(token.chainKey,address));
      }
    }catch(error){console.warn(`[market] refresh failed for ${address}:`,sanitizeRpcError(error));}
    finally{queued.delete(key);}
  });
}
