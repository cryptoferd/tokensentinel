const openSeaChains:Record<string,string>={
  ethereum:'ethereum',
  base:'base',
  arbitrum:'arbitrum',
  optimism:'optimism',
  polygon:'matic',
  bnb:'bsc',
  avalanche:'avalanche',
  linea:'linea'
};

export const dexScreenerUrl=(address:string)=>`https://dexscreener.com/search?q=${encodeURIComponent(address)}`;

export function openSeaUrl(chainKey:string,address:string){
  const chain=openSeaChains[chainKey];
  return chain
    ? `https://opensea.io/assets/${chain}?search[query]=${encodeURIComponent(address)}`
    : `https://opensea.io/assets?search[query]=${encodeURIComponent(address)}`;
}
