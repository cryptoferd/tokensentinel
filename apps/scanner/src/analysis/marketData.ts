interface DexPair {
  pairAddress?:string;
  labels?:string[];
  baseToken?:{address?:string};
  quoteToken?:{address?:string};
  marketCap?:number|null;
  fdv?:number|null;
  liquidity?:{usd?:number|null}|null;
}

export async function getMarketData(address:string) {
  try {
    const response=await fetch(`https://api.dexscreener.com/token-pairs/v1/robinhood/${address}`,{headers:{Accept:'application/json'},signal:AbortSignal.timeout(12_000)});
    if(!response.ok)return {marketCapUsd:null,liquidityUsd:null,pair:null};
    const pairs=await response.json() as DexPair[];
    if(!Array.isArray(pairs)||!pairs.length)return {marketCapUsd:null,liquidityUsd:null,pair:null};
    const best=[...pairs].sort((a,b)=>(b.liquidity?.usd??0)-(a.liquidity?.usd??0))[0];
    const protocol:'v2'|'v3'|'unknown'=best.labels?.includes('v3')?'v3':best.labels?.includes('v2')?'v2':'unknown';
    const pair=best.pairAddress&&best.baseToken?.address&&best.quoteToken?.address?{address:best.pairAddress,protocol,token0:best.baseToken.address,token1:best.quoteToken.address}:null;
    return {marketCapUsd:best.marketCap??best.fdv??null,liquidityUsd:best.liquidity?.usd??null,pair};
  } catch { return {marketCapUsd:null,liquidityUsd:null,pair:null}; }
}
