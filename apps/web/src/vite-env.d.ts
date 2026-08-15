/// <reference types="vite/client" />

interface EthereumProvider {
  request(args:{method:string;params?:unknown[]}):Promise<unknown>;
  isMetaMask?:boolean;
  isRabby?:boolean;
  isCoinbaseWallet?:boolean;
}
interface Window { ethereum?:EthereumProvider }

interface EIP6963ProviderInfo { uuid:string; name:string; icon:string; rdns:string }
interface EIP6963ProviderDetail { info:EIP6963ProviderInfo; provider:EthereumProvider }
