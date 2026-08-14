import Database from 'better-sqlite3';
import { config } from '../config.js';

export const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS state (
  key TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
CREATE TABLE IF NOT EXISTS tokens (
  address TEXT PRIMARY KEY,
  name TEXT,
  symbol TEXT,
  decimals INTEGER,
  total_supply TEXT,
  deployer TEXT,
  deployment_tx TEXT,
  deployment_block INTEGER NOT NULL,
  first_seen_at INTEGER NOT NULL,
  analysis_state TEXT NOT NULL DEFAULT 'queued',
  risk_score INTEGER NOT NULL DEFAULT 0,
  risk_label TEXT NOT NULL DEFAULT 'LOW',
  verified INTEGER,
  source_available INTEGER,
  owner TEXT,
  ownership_renounced INTEGER,
  buy_tax REAL,
  sell_tax REAL,
  top5_percent REAL,
  circulating_top5_percent REAL,
  holder_count_estimate INTEGER,
  warnings_json TEXT NOT NULL DEFAULT '[]',
  bytecode_flags_json TEXT NOT NULL DEFAULT '[]',
  top_holders_json TEXT NOT NULL DEFAULT '[]',
  updated_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_tokens_block ON tokens(deployment_block DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_risk ON tokens(risk_score DESC);
CREATE TABLE IF NOT EXISTS pools (
  address TEXT PRIMARY KEY,
  factory TEXT,
  protocol TEXT NOT NULL,
  token0 TEXT,
  token1 TEXT,
  fee INTEGER,
  created_block INTEGER,
  created_tx TEXT,
  created_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_pools_token0 ON pools(token0);
CREATE INDEX IF NOT EXISTS idx_pools_token1 ON pools(token1);
`);
