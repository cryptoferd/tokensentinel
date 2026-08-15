export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AnalysisState = 'queued' | 'analyzing' | 'complete' | 'partial' | 'failed';
export type AssetType = 'ERC20' | 'ERC721';
export type ScanAssetType = AssetType | 'BOTH';
export interface ChainOption {
  key: string;
  id: number;
  name: string;
  shortName: string;
  explorerUrl: string;
  enabled: boolean;
}

export interface Warning {
  code: string;
  title: string;
  severity: Severity;
  detail: string;
  evidence?: string;
}
export interface Holder {
  address: string;
  balance: string;
  percent: number;
  excluded: boolean;
  label?: string | null;
}
export interface PoolInfo {
  address: string;
  factory?: string | null;
  protocol: 'v2' | 'v3' | 'unknown';
  token0?: string | null;
  token1?: string | null;
  fee?: number | null;
  createdBlock?: number | null;
  createdTx?: string | null;
}
export interface TokenRecord {
  chainKey: string;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  address: string;
  assetType: AssetType;
  name: string | null;
  symbol: string | null;
  decimals: number | null;
  totalSupply: string | null;
  deployer: string | null;
  deploymentTx: string | null;
  deploymentBlock: number;
  firstSeenAt: number;
  analysisState: AnalysisState;
  riskScore: number;
  riskLabel: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  verified: boolean | null;
  sourceAvailable: boolean | null;
  owner: string | null;
  ownershipRenounced: boolean | null;
  buyTax: number | null;
  sellTax: number | null;
  top5Percent: number | null;
  circulatingTop5Percent: number | null;
  holderCountEstimate: number | null;
  marketCapUsd: number | null;
  liquidityUsd: number | null;
  poolCreated: boolean;
  pools: PoolInfo[];
  topHolders: Holder[];
  warnings: Warning[];
  bytecodeFlags: string[];
  updatedAt: number;
}
export type ScanMode = 'live' | 'history';
export type ScanStatus = 'running' | 'complete' | 'stopped' | 'failed';
export interface ScanSession {
  id: string;
  userAddress: string;
  mode: ScanMode;
  assetType: ScanAssetType;
  chainKey: string;
  chainId: number;
  chainName: string;
  explorerUrl: string;
  durationMinutes: number | null;
  lookbackMinutes: number | null;
  startedAt: number;
  endsAt: number | null;
  completedAt: number | null;
  status: ScanStatus;
  fromBlock: number | null;
  toBlock: number | null;
  scannedBlocks: number;
  totalBlocks: number;
  resultCount: number;
  error: string | null;
}
export interface TokenFilters {
  assetType?: AssetType;
  q?: string;
  risk?: string;
  minMarketCap?: number;
  maxMarketCap?: number;
  minHolders?: number;
  maxHolders?: number;
  maxTop5?: number;
  maxBuyTax?: number;
  maxSellTax?: number;
  hasLiquidity?: boolean;
}
export interface Stats {
  latestBlock: number;
  scannedBlock: number;
  tokenCount: number;
  poolCount: number;
  highRiskCount: number;
  scannerRunning: boolean;
  scannerStartedAt: number | null;
  scannerEndsAt: number | null;
  queueDepth: number;
}
