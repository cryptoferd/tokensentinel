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

const cleanPhrase=(value:string)=>value.replace(/["\\]/g,'').trim();
const xLatestSearchUrl=(query:string)=>`https://x.com/search?f=live&q=${encodeURIComponent(query)}&src=typed_query`;

export function xInvestigationUrls(asset:{address:string;name:string|null;symbol:string|null;chainName:string}){
  const address=`"${asset.address}"`;
  const name=asset.name?cleanPhrase(asset.name):'';
  const symbol=asset.symbol?asset.symbol.replace(/[^a-zA-Z0-9_]/g,''):'';
  const chain=cleanPhrase(asset.chainName);
  const identities=[name?`"${name}"`:'',symbol?`$${symbol}`:''].filter(Boolean);
  const discussion=identities.length?`(${identities.join(' OR ')}) "${chain}" -is:retweet`:`${address} "${chain}" -is:retweet`;
  return [
    xLatestSearchUrl(address),
    xLatestSearchUrl(discussion),
    xLatestSearchUrl(`${address} (scam OR rug OR honeypot OR fake OR exploit OR hacked)`)
  ];
}
