import Database from 'better-sqlite3';
import { config } from '../config.js';

export const db = new Database(config.DB_PATH);
db.pragma('journal_mode = WAL');
db.pragma('synchronous = NORMAL');
db.pragma('foreign_keys = ON');

db.exec(`
CREATE TABLE IF NOT EXISTS state (key TEXT PRIMARY KEY,value TEXT NOT NULL);
CREATE TABLE IF NOT EXISTS auth_challenges (address TEXT PRIMARY KEY,message TEXT NOT NULL,expires_at INTEGER NOT NULL);
CREATE TABLE IF NOT EXISTS auth_sessions (token_hash TEXT PRIMARY KEY,address TEXT NOT NULL,created_at INTEGER NOT NULL,expires_at INTEGER NOT NULL);
CREATE INDEX IF NOT EXISTS idx_auth_sessions_address ON auth_sessions(address);
CREATE TABLE IF NOT EXISTS scan_sessions (
  id TEXT PRIMARY KEY,user_address TEXT NOT NULL,mode TEXT NOT NULL,asset_type TEXT NOT NULL DEFAULT 'ERC20',
  chain_key TEXT NOT NULL DEFAULT 'robinhood',chain_id INTEGER NOT NULL DEFAULT 4663,chain_name TEXT NOT NULL DEFAULT 'Robinhood Chain',explorer_url TEXT NOT NULL DEFAULT 'https://robinhoodchain.blockscout.com',
  duration_minutes INTEGER,lookback_minutes INTEGER,started_at INTEGER NOT NULL,ends_at INTEGER,completed_at INTEGER,status TEXT NOT NULL,
  from_block INTEGER,to_block INTEGER,scanned_blocks INTEGER NOT NULL DEFAULT 0,total_blocks INTEGER NOT NULL DEFAULT 0,error TEXT
);
CREATE TABLE IF NOT EXISTS tokens (
  chain_key TEXT NOT NULL,chain_id INTEGER NOT NULL,chain_name TEXT NOT NULL,explorer_url TEXT NOT NULL,address TEXT NOT NULL,
  asset_type TEXT NOT NULL DEFAULT 'ERC20',name TEXT,symbol TEXT,decimals INTEGER,total_supply TEXT,deployer TEXT,deployment_tx TEXT,
  deployment_block INTEGER NOT NULL,first_seen_at INTEGER NOT NULL,analysis_state TEXT NOT NULL DEFAULT 'queued',risk_score INTEGER NOT NULL DEFAULT 0,
  risk_label TEXT NOT NULL DEFAULT 'LOW',verified INTEGER,source_available INTEGER,owner TEXT,ownership_renounced INTEGER,buy_tax REAL,sell_tax REAL,
  top5_percent REAL,circulating_top5_percent REAL,holder_count_estimate INTEGER,market_cap_usd REAL,liquidity_usd REAL,
  warnings_json TEXT NOT NULL DEFAULT '[]',bytecode_flags_json TEXT NOT NULL DEFAULT '[]',top_holders_json TEXT NOT NULL DEFAULT '[]',updated_at INTEGER NOT NULL,
  PRIMARY KEY(chain_key,address)
);
CREATE TABLE IF NOT EXISTS pools (
  chain_key TEXT NOT NULL,address TEXT NOT NULL,factory TEXT,protocol TEXT NOT NULL,token0 TEXT,token1 TEXT,fee INTEGER,created_block INTEGER,created_tx TEXT,created_at INTEGER NOT NULL,
  PRIMARY KEY(chain_key,address)
);
CREATE TABLE IF NOT EXISTS scan_results (
  scan_id TEXT NOT NULL,chain_key TEXT NOT NULL,token_address TEXT NOT NULL,discovered_at INTEGER NOT NULL,
  PRIMARY KEY(scan_id,chain_key,token_address),FOREIGN KEY(scan_id) REFERENCES scan_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY(chain_key,token_address) REFERENCES tokens(chain_key,address) ON DELETE CASCADE
);
`);

function columns(table:string) { return db.prepare(`PRAGMA table_info(${table})`).all() as Array<{name:string;pk:number}>; }
function ensureColumn(table:string,name:string,definition:string) {
  if(!columns(table).some(column=>column.name===name))db.exec(`ALTER TABLE ${table} ADD COLUMN ${name} ${definition}`);
}

ensureColumn('scan_sessions','asset_type',"TEXT NOT NULL DEFAULT 'ERC20'");
ensureColumn('scan_sessions','chain_key',"TEXT NOT NULL DEFAULT 'robinhood'");
ensureColumn('scan_sessions','chain_id','INTEGER NOT NULL DEFAULT 4663');
ensureColumn('scan_sessions','chain_name',"TEXT NOT NULL DEFAULT 'Robinhood Chain'");
ensureColumn('scan_sessions','explorer_url',"TEXT NOT NULL DEFAULT 'https://robinhoodchain.blockscout.com'");

// Upgrade the original address-only schema without discarding existing Robinhood scans.
if(!columns('tokens').some(column=>column.name==='chain_key')) {
  db.pragma('foreign_keys = OFF');
  db.transaction(()=>db.exec(`
    ALTER TABLE tokens RENAME TO tokens_legacy;
    ALTER TABLE pools RENAME TO pools_legacy;
    ALTER TABLE scan_results RENAME TO scan_results_legacy;
    CREATE TABLE tokens (
      chain_key TEXT NOT NULL,chain_id INTEGER NOT NULL,chain_name TEXT NOT NULL,explorer_url TEXT NOT NULL,address TEXT NOT NULL,
      asset_type TEXT NOT NULL DEFAULT 'ERC20',name TEXT,symbol TEXT,decimals INTEGER,total_supply TEXT,deployer TEXT,deployment_tx TEXT,
      deployment_block INTEGER NOT NULL,first_seen_at INTEGER NOT NULL,analysis_state TEXT NOT NULL DEFAULT 'queued',risk_score INTEGER NOT NULL DEFAULT 0,
      risk_label TEXT NOT NULL DEFAULT 'LOW',verified INTEGER,source_available INTEGER,owner TEXT,ownership_renounced INTEGER,buy_tax REAL,sell_tax REAL,
      top5_percent REAL,circulating_top5_percent REAL,holder_count_estimate INTEGER,market_cap_usd REAL,liquidity_usd REAL,
      warnings_json TEXT NOT NULL DEFAULT '[]',bytecode_flags_json TEXT NOT NULL DEFAULT '[]',top_holders_json TEXT NOT NULL DEFAULT '[]',updated_at INTEGER NOT NULL,
      PRIMARY KEY(chain_key,address)
    );
    INSERT INTO tokens SELECT 'robinhood',4663,'Robinhood Chain','https://robinhoodchain.blockscout.com',address,asset_type,name,symbol,decimals,total_supply,deployer,deployment_tx,deployment_block,first_seen_at,analysis_state,risk_score,risk_label,verified,source_available,owner,ownership_renounced,buy_tax,sell_tax,top5_percent,circulating_top5_percent,holder_count_estimate,market_cap_usd,liquidity_usd,warnings_json,bytecode_flags_json,top_holders_json,updated_at FROM tokens_legacy;
    CREATE TABLE pools (chain_key TEXT NOT NULL,address TEXT NOT NULL,factory TEXT,protocol TEXT NOT NULL,token0 TEXT,token1 TEXT,fee INTEGER,created_block INTEGER,created_tx TEXT,created_at INTEGER NOT NULL,PRIMARY KEY(chain_key,address));
    INSERT INTO pools SELECT 'robinhood',address,factory,protocol,token0,token1,fee,created_block,created_tx,created_at FROM pools_legacy;
    CREATE TABLE scan_results (scan_id TEXT NOT NULL,chain_key TEXT NOT NULL,token_address TEXT NOT NULL,discovered_at INTEGER NOT NULL,PRIMARY KEY(scan_id,chain_key,token_address),FOREIGN KEY(scan_id) REFERENCES scan_sessions(id) ON DELETE CASCADE,FOREIGN KEY(chain_key,token_address) REFERENCES tokens(chain_key,address) ON DELETE CASCADE);
    INSERT INTO scan_results SELECT scan_id,'robinhood',token_address,discovered_at FROM scan_results_legacy;
    DROP TABLE tokens_legacy;DROP TABLE pools_legacy;DROP TABLE scan_results_legacy;
  `))();
  db.pragma('foreign_keys = ON');
}

db.exec(`
CREATE INDEX IF NOT EXISTS idx_tokens_block ON tokens(chain_key,deployment_block DESC);
CREATE INDEX IF NOT EXISTS idx_tokens_risk ON tokens(chain_key,risk_score DESC);
CREATE INDEX IF NOT EXISTS idx_pools_token0 ON pools(chain_key,token0);
CREATE INDEX IF NOT EXISTS idx_pools_token1 ON pools(chain_key,token1);
CREATE INDEX IF NOT EXISTS idx_scan_sessions_user ON scan_sessions(user_address,started_at DESC);
CREATE INDEX IF NOT EXISTS idx_scan_results_scan ON scan_results(scan_id,discovered_at DESC);
`);
const legacyScanned=db.prepare("SELECT value FROM state WHERE key='last_scanned_block'").get() as {value:string}|undefined;
if(legacyScanned)db.prepare("INSERT OR IGNORE INTO state(key,value) VALUES('last_scanned_block:robinhood',?)").run(legacyScanned.value);
