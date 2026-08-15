import type { ChainOption } from '@sentinel/shared';
import { createPublicClient, defineChain, http } from 'viem';
import { config } from '../config.js';

export interface ChainDefinition extends Omit<ChainOption,'enabled'> {
  alchemyHost:string;
  dexScreenerSlug:string;
  blockscoutApiUrl:string|null;
  nativeSymbol:string;
  fallbackRpc?:string;
}

export const CHAINS:ChainDefinition[]=[
  {key:'robinhood',id:4663,name:'Robinhood Chain',shortName:'Robinhood',alchemyHost:'robinhood-mainnet',dexScreenerSlug:'robinhood',explorerUrl:'https://robinhoodchain.blockscout.com',blockscoutApiUrl:'https://robinhoodchain.blockscout.com/api',nativeSymbol:'ETH',fallbackRpc:config.RPC_URL},
  {key:'ethereum',id:1,name:'Ethereum Mainnet',shortName:'Ethereum',alchemyHost:'eth-mainnet',dexScreenerSlug:'ethereum',explorerUrl:'https://etherscan.io',blockscoutApiUrl:'https://eth.blockscout.com/api',nativeSymbol:'ETH'},
  {key:'base',id:8453,name:'Base',shortName:'Base',alchemyHost:'base-mainnet',dexScreenerSlug:'base',explorerUrl:'https://basescan.org',blockscoutApiUrl:'https://base.blockscout.com/api',nativeSymbol:'ETH'},
  {key:'arbitrum',id:42161,name:'Arbitrum One',shortName:'Arbitrum',alchemyHost:'arb-mainnet',dexScreenerSlug:'arbitrum',explorerUrl:'https://arbiscan.io',blockscoutApiUrl:'https://arbitrum.blockscout.com/api',nativeSymbol:'ETH'},
  {key:'optimism',id:10,name:'OP Mainnet',shortName:'Optimism',alchemyHost:'opt-mainnet',dexScreenerSlug:'optimism',explorerUrl:'https://optimistic.etherscan.io',blockscoutApiUrl:'https://optimism.blockscout.com/api',nativeSymbol:'ETH'},
  {key:'polygon',id:137,name:'Polygon PoS',shortName:'Polygon',alchemyHost:'polygon-mainnet',dexScreenerSlug:'polygon',explorerUrl:'https://polygonscan.com',blockscoutApiUrl:'https://polygon.blockscout.com/api',nativeSymbol:'POL'},
  {key:'bnb',id:56,name:'BNB Smart Chain',shortName:'BNB Chain',alchemyHost:'bnb-mainnet',dexScreenerSlug:'bsc',explorerUrl:'https://bscscan.com',blockscoutApiUrl:null,nativeSymbol:'BNB'},
  {key:'avalanche',id:43114,name:'Avalanche C-Chain',shortName:'Avalanche',alchemyHost:'avax-mainnet',dexScreenerSlug:'avalanche',explorerUrl:'https://snowtrace.io',blockscoutApiUrl:null,nativeSymbol:'AVAX'},
  {key:'linea',id:59144,name:'Linea',shortName:'Linea',alchemyHost:'linea-mainnet',dexScreenerSlug:'linea',explorerUrl:'https://lineascan.build',blockscoutApiUrl:'https://explorer.linea.build/api',nativeSymbol:'ETH'}
];

export function getChain(key:string) {
  const chain=CHAINS.find(item=>item.key===key);
  if(!chain)throw new Error(`Unsupported chain: ${key}`);
  return chain;
}
export function rpcUrl(chain:ChainDefinition) {
  if(config.ALCHEMY_API_KEY)return `https://${chain.alchemyHost}.g.alchemy.com/v2/${config.ALCHEMY_API_KEY}`;
  if(chain.fallbackRpc)return chain.fallbackRpc;
  throw new Error('ALCHEMY_API_KEY is required for this chain. Add it to the Railway scanner variables.');
}
const clients=new Map<string,ReturnType<typeof createPublicClient>>();
export function getClient(key:string) {
  const existing=clients.get(key);if(existing)return existing;
  const chain=getChain(key);const url=rpcUrl(chain);
  const viemChain=defineChain({id:chain.id,name:chain.name,nativeCurrency:{name:chain.nativeSymbol,symbol:chain.nativeSymbol,decimals:18},rpcUrls:{default:{http:[url]}},blockExplorers:{default:{name:'Explorer',url:chain.explorerUrl}}});
  const client=createPublicClient({chain:viemChain,transport:http(url,{timeout:30_000,retryCount:3,retryDelay:500}),batch:{multicall:true}});
  clients.set(key,client);return client;
}
export const chainOptions=():ChainOption[]=>CHAINS.map(chain=>({key:chain.key,id:chain.id,name:chain.name,shortName:chain.shortName,explorerUrl:chain.explorerUrl,enabled:Boolean(config.ALCHEMY_API_KEY||chain.fallbackRpc)}));
