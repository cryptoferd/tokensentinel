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
  asset_type TEXT NOT NULL DEFAULT 'ERC20',
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
CREATE TABLE IF NOT EXISTS auth_challenges (
  address TEXT PRIMARY KEY,
  message TEXT NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE TABLE IF NOT EXISTS auth_sessions (
  token_hash TEXT PRIMARY KEY,
  address TEXT NOT NULL,
  created_at INTEGER NOT NULL,
  expires_at INTEGER NOT NULL
);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_address ON auth_sessions(address);
CREATE TABLE IF NOT EXISTS scan_sessions (
  id TEXT PRIMARY KEY,
  user_address TEXT NOT NULL,
  mode TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'ERC20',
  duration_minutes INTEGER,
  lookback_minutes INTEGER,
  started_at INTEGER NOT NULL,
  ends_at INTEGER,
  completed_at INTEGER,
  status TEXT NOT NULL,
  from_block INTEGER,
  to_block INTEGER,
  scanned_blocks INTEGER NOT NULL DEFAULT 0,
  total_blocks INTEGER NOT NULL DEFAULT 0,
  error TEXT
);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user ON scan_sessions(user_address, started_at DESC);
CREATE TABLE IF NOT EXISTS scan_results (
  scan_id TEXT NOT NULL,
  token_address TEXT NOT NULL,
  discovered_at INTEGER NOT NULL,
  PRIMARY KEY(scan_id, token_address),
  FOREIGN KEY(scan_id) REFERENCES scan_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(token_address) REFERENCES tokens(address) ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan ON scan_results(scan_id, discovered_at DESC);
`);

function ensureColumn(table: string, name: string, definition: string) {
  const columns = db.prepare(`PRAGMA table_info(${table})`).all() as Array<{ name: string }>;
  if (!columns.some(column => column.name === name)) db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn('tokens', 'market_cap_usd', 'REAL');
ensureColumn('tokens', 'liquidity_usd', 'REAL');
ensureColumn('tokens', 'asset_type', "TEXT NOT NULL DEFAULT 'ERC20'");
ensureColumn('scan_sessions', 'asset_type', "TEXT NOT NULL DEFAULT 'ERC20'");
