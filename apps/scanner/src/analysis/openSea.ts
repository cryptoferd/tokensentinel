import { getChain } from '../chain/chains.js';
import { config } from '../config.js';

interface OpenSeaContractResponse {
  collection?:string|{slug?:string|null}|null;
}

export async function getOpenSeaCollectionSlug(chainKey:string,address:string) {
  const chain=getChain(chainKey).openSeaChain;
  if(!chain||!config.OPENSEA_API_KEY)return null;
  try{
    const response=await fetch(`https://api.opensea.io/api/v2/chain/${chain}/contract/${address}`,{
      headers:{Accept:'application/json','x-api-key':config.OPENSEA_API_KEY},
      signal:AbortSignal.timeout(12_000)
    });
    if(!response.ok)return null;
    const data=await response.json() as OpenSeaContractResponse;
    const slug=typeof data.collection==='string'?data.collection:data.collection?.slug;
    return typeof slug==='string'&&slug.trim()?slug.trim():null;
  }catch{return null;}
}
