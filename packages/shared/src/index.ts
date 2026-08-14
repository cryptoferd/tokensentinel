export type Severity = 'info' | 'low' | 'medium' | 'high' | 'critical';
export type AnalysisState = 'queued' | 'analyzing' | 'complete' | 'partial' | 'failed';

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
  address: string;
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
  poolCreated: boolean;
  pools: PoolInfo[];
  topHolders: Holder[];
  warnings: Warning[];
  bytecodeFlags: string[];
  updatedAt: number;
}
export interface Stats {
  latestBlock: number;
  scannedBlock: number;
  tokenCount: number;
  poolCount: number;
  highRiskCount: number;
  scannerRunning: boolean;
  queueDepth: number;
}
