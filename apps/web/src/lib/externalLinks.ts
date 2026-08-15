const dexScreenerChains:Record<string,string>={
  robinhood:'robinhood',
  ethereum:'ethereum',
  base:'base',
  arbitrum:'arbitrum',
  optimism:'optimism',
  polygon:'polygon',
  bnb:'bsc',
  avalanche:'avalanche',
  linea:'linea'
};

export const dexScreenerUrl=(chainKey:string,address:string)=>`https://dexscreener.com/${dexScreenerChains[chainKey]??chainKey}/${address}`;

export const openSeaUrl=(collectionSlug:string)=>`https://opensea.io/collection/${encodeURIComponent(collectionSlug)}`;
