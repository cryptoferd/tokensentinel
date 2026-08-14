import 'dotenv/config';
import path from 'node:path';
import { z } from 'zod';

const envSchema = z.object({
  RPC_URL: z.string().url().default('https://rpc.mainnet.chain.robinhood.com'),
  CHAIN_ID: z.coerce.number().int().positive().default(4663),
  BLOCKSCOUT_API_URL: z.string().url().default('https://robinhoodchain.blockscout.com/api'),
  BLOCKSCOUT_BASE_URL: z.string().url().default('https://robinhoodchain.blockscout.com'),
  WETH_ADDRESS: z.string().default('0x0Bd7D308f8E1639FAb988df18A8011f41EAcAD73'),
  PORT: z.coerce.number().int().positive().default(8787),
  HOST: z.string().default('0.0.0.0'),
  DB_PATH: z.string().optional(),
  RAILWAY_VOLUME_MOUNT_PATH: z.string().optional(),
  START_BLOCK: z.string().default('latest'),
  POLL_INTERVAL_MS: z.coerce.number().int().min(250).default(1500),
  CONFIRMATIONS: z.coerce.number().int().min(0).default(0),
  MAX_BLOCKS_PER_TICK: z.coerce.number().int().min(1).max(100).default(5),
  ANALYSIS_CONCURRENCY: z.coerce.number().int().min(1).max(16).default(2),
  HOLDER_LOOKBACK_BLOCKS: z.coerce.number().int().min(100).default(50000),
  MAX_TRANSFER_LOGS: z.coerce.number().int().min(100).default(20000),
  SCANNER_AUTO_START: z.string().default('false').transform(value => value.toLowerCase() === 'true'),
  DEX_V2_FACTORIES: z.string().default(''),
  DEX_V3_FACTORIES: z.string().default(''),
  KNOWN_ROUTERS: z.string().default(''),
  CORS_ORIGINS: z.string().default('http://localhost:5173,https://*.vercel.app')
});

const raw = envSchema.parse(process.env);
const list = (value: string) => value.split(',').map(v => v.trim().toLowerCase()).filter(Boolean);

export const config = {
  ...raw,
  DB_PATH: raw.DB_PATH ?? (raw.RAILWAY_VOLUME_MOUNT_PATH
    ? path.join(raw.RAILWAY_VOLUME_MOUNT_PATH, 'sentinel.db')
    : './sentinel.db'),
  dexV2Factories: list(raw.DEX_V2_FACTORIES),
  dexV3Factories: list(raw.DEX_V3_FACTORIES),
  knownRouters: list(raw.KNOWN_ROUTERS),
  corsOrigins: list(raw.CORS_ORIGINS)
};
