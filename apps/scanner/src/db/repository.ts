import type { AnalysisState, Holder, PoolInfo, ScanSession, TokenFilters, TokenRecord, Warning } from '@sentinel/shared';
import { db } from './database.js';

const bool = (v: unknown): boolean | null => v === null || v === undefined ? null : Number(v) === 1;
const parse = <T>(v: unknown, fallback: T): T => { try { return v ? JSON.parse(String(v)) as T : fallback; } catch { return fallback; } };

export function getState(key: string): string | null {
  const row = db.prepare('SELECT value FROM state WHERE key=?').get(key) as { value: string } | undefined;
  return row?.value ?? null;
}
export function setState(key: string, value: string) {
  db.prepare('INSERT INTO state(key,value) VALUES(?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value').run(key, value);
}

export function upsertToken(input: Partial<TokenRecord> & Pick<TokenRecord, 'address' | 'deploymentBlock' | 'firstSeenAt'>) {
  const now = Date.now();
  db.prepare(`INSERT INTO tokens(address,name,symbol,decimals,total_supply,deployer,deployment_tx,deployment_block,first_seen_at,analysis_state,risk_score,risk_label,verified,source_available,owner,ownership_renounced,buy_tax,sell_tax,top5_percent,circulating_top5_percent,holder_count_estimate,market_cap_usd,liquidity_usd,warnings_json,bytecode_flags_json,top_holders_json,updated_at)
  VALUES(@address,@name,@symbol,@decimals,@totalSupply,@deployer,@deploymentTx,@deploymentBlock,@firstSeenAt,@analysisState,@riskScore,@riskLabel,@verified,@sourceAvailable,@owner,@ownershipRenounced,@buyTax,@sellTax,@top5Percent,@circulatingTop5Percent,@holderCountEstimate,@marketCapUsd,@liquidityUsd,@warnings,@flags,@holders,@updatedAt)
  ON CONFLICT(address) DO UPDATE SET
    name=COALESCE(excluded.name,tokens.name), symbol=COALESCE(excluded.symbol,tokens.symbol), decimals=COALESCE(excluded.decimals,tokens.decimals),
    total_supply=COALESCE(excluded.total_supply,tokens.total_supply), deployer=COALESCE(excluded.deployer,tokens.deployer), deployment_tx=COALESCE(excluded.deployment_tx,tokens.deployment_tx),
    analysis_state=excluded.analysis_state, risk_score=excluded.risk_score, risk_label=excluded.risk_label, verified=COALESCE(excluded.verified,tokens.verified),
    source_available=COALESCE(excluded.source_available,tokens.source_available), owner=COALESCE(excluded.owner,tokens.owner), ownership_renounced=COALESCE(excluded.ownership_renounced,tokens.ownership_renounced), buy_tax=COALESCE(excluded.buy_tax,tokens.buy_tax), sell_tax=COALESCE(excluded.sell_tax,tokens.sell_tax),
    top5_percent=COALESCE(excluded.top5_percent,tokens.top5_percent), circulating_top5_percent=COALESCE(excluded.circulating_top5_percent,tokens.circulating_top5_percent),
    holder_count_estimate=COALESCE(excluded.holder_count_estimate,tokens.holder_count_estimate), market_cap_usd=COALESCE(excluded.market_cap_usd,tokens.market_cap_usd), liquidity_usd=COALESCE(excluded.liquidity_usd,tokens.liquidity_usd), warnings_json=excluded.warnings_json, bytecode_flags_json=excluded.bytecode_flags_json,
    top_holders_json=excluded.top_holders_json, updated_at=excluded.updated_at`).run({
      address: input.address.toLowerCase(), name: input.name ?? null, symbol: input.symbol ?? null, decimals: input.decimals ?? null,
      totalSupply: input.totalSupply ?? null, deployer: input.deployer?.toLowerCase() ?? null, deploymentTx: input.deploymentTx ?? null,
      deploymentBlock: input.deploymentBlock, firstSeenAt: input.firstSeenAt, analysisState: input.analysisState ?? 'queued', riskScore: input.riskScore ?? 0,
      riskLabel: input.riskLabel ?? 'LOW', verified: input.verified == null ? null : Number(input.verified), sourceAvailable: input.sourceAvailable == null ? null : Number(input.sourceAvailable),
      owner: input.owner?.toLowerCase() ?? null, ownershipRenounced: input.ownershipRenounced == null ? null : Number(input.ownershipRenounced), buyTax: input.buyTax ?? null, sellTax: input.sellTax ?? null, top5Percent: input.top5Percent ?? null,
      circulatingTop5Percent: input.circulatingTop5Percent ?? null, holderCountEstimate: input.holderCountEstimate ?? null, marketCapUsd: input.marketCapUsd ?? null, liquidityUsd: input.liquidityUsd ?? null,
      warnings: JSON.stringify(input.warnings ?? []), flags: JSON.stringify(input.bytecodeFlags ?? []), holders: JSON.stringify(input.topHolders ?? []), updatedAt: input.updatedAt ?? now
    });
}

export function updateToken(address: string, patch: Partial<TokenRecord>) {
  const existing = getToken(address);
  if (!existing) return;
  upsertToken({ ...existing, ...patch, address: existing.address, deploymentBlock: existing.deploymentBlock, firstSeenAt: existing.firstSeenAt });
}

export function upsertPool(pool: PoolInfo) {
  db.prepare(`INSERT INTO pools(address,factory,protocol,token0,token1,fee,created_block,created_tx,created_at)
  VALUES(?,?,?,?,?,?,?,?,?) ON CONFLICT(address) DO UPDATE SET factory=excluded.factory,protocol=excluded.protocol,token0=excluded.token0,token1=excluded.token1,fee=excluded.fee,created_block=excluded.created_block,created_tx=excluded.created_tx`).run(
    pool.address.toLowerCase(), pool.factory?.toLowerCase() ?? null, pool.protocol, pool.token0?.toLowerCase() ?? null, pool.token1?.toLowerCase() ?? null, pool.fee ?? null, pool.createdBlock ?? null, pool.createdTx ?? null, Date.now()
  );
}

function rowToToken(r: any): TokenRecord {
  const pools = db.prepare('SELECT * FROM pools WHERE token0=? OR token1=? ORDER BY created_block DESC').all(r.address, r.address).map((p: any) => ({
    address: p.address, factory: p.factory, protocol: p.protocol, token0: p.token0, token1: p.token1, fee: p.fee, createdBlock: p.created_block, createdTx: p.created_tx
  })) as PoolInfo[];
  return {
    address: r.address, name: r.name, symbol: r.symbol, decimals: r.decimals, totalSupply: r.total_supply, deployer: r.deployer, deploymentTx: r.deployment_tx,
    deploymentBlock: r.deployment_block, firstSeenAt: r.first_seen_at, analysisState: r.analysis_state as AnalysisState, riskScore: r.risk_score, riskLabel: r.risk_label,
    verified: bool(r.verified), sourceAvailable: bool(r.source_available), owner: r.owner, ownershipRenounced: bool(r.ownership_renounced), buyTax: r.buy_tax, sellTax: r.sell_tax, top5Percent: r.top5_percent,
    circulatingTop5Percent: r.circulating_top5_percent, holderCountEstimate: r.holder_count_estimate, marketCapUsd: r.market_cap_usd, liquidityUsd: r.liquidity_usd, poolCreated: pools.length > 0, pools,
    topHolders: parse<Holder[]>(r.top_holders_json, []), warnings: parse<Warning[]>(r.warnings_json, []), bytecodeFlags: parse<string[]>(r.bytecode_flags_json, []), updatedAt: r.updated_at
  };
}

export function getToken(address: string): TokenRecord | null {
  const row = db.prepare('SELECT * FROM tokens WHERE address=?').get(address.toLowerCase());
  return row ? rowToToken(row) : null;
}
export function listTokens(opts: { limit: number; offset: number; risk?: string; q?: string }) {
  const where: string[] = []; const params: any[] = [];
  if (opts.risk) { where.push('risk_label=?'); params.push(opts.risk.toUpperCase()); }
  if (opts.q) { where.push('(address LIKE ? OR name LIKE ? OR symbol LIKE ?)'); const q = `%${opts.q}%`; params.push(q,q,q); }
  const sql = `SELECT * FROM tokens ${where.length ? 'WHERE '+where.join(' AND ') : ''} ORDER BY deployment_block DESC, first_seen_at DESC LIMIT ? OFFSET ?`;
  params.push(opts.limit, opts.offset);
  return (db.prepare(sql).all(...params) as any[]).map(rowToToken);
}

function filterSql(filters: TokenFilters, alias = 't') {
  const where: string[] = []; const params: unknown[] = [];
  if (filters.q) { where.push(`(${alias}.address LIKE ? OR ${alias}.name LIKE ? OR ${alias}.symbol LIKE ?)`); const q = `%${filters.q}%`; params.push(q,q,q); }
  if (filters.risk) { where.push(`${alias}.risk_label=?`); params.push(filters.risk.toUpperCase()); }
  if (filters.minMarketCap != null) { where.push(`${alias}.market_cap_usd>=?`); params.push(filters.minMarketCap); }
  if (filters.maxMarketCap != null) { where.push(`${alias}.market_cap_usd<=?`); params.push(filters.maxMarketCap); }
  if (filters.minHolders != null) { where.push(`${alias}.holder_count_estimate>=?`); params.push(filters.minHolders); }
  if (filters.maxHolders != null) { where.push(`${alias}.holder_count_estimate<=?`); params.push(filters.maxHolders); }
  if (filters.maxTop5 != null) { where.push(`${alias}.circulating_top5_percent<=?`); params.push(filters.maxTop5); }
  if (filters.maxBuyTax != null) { where.push(`${alias}.buy_tax<=?`); params.push(filters.maxBuyTax); }
  if (filters.maxSellTax != null) { where.push(`${alias}.sell_tax<=?`); params.push(filters.maxSellTax); }
  if (filters.hasLiquidity != null) where.push(`${filters.hasLiquidity ? 'EXISTS' : 'NOT EXISTS'} (SELECT 1 FROM pools p WHERE p.token0=${alias}.address OR p.token1=${alias}.address)`);
  return { where, params };
}

export function listScanTokens(scanId: string, userAddress: string, filters: TokenFilters, limit: number, offset: number) {
  const built = filterSql(filters);
  const sql = `SELECT t.* FROM scan_results sr JOIN scan_sessions s ON s.id=sr.scan_id JOIN tokens t ON t.address=sr.token_address
    WHERE sr.scan_id=? AND s.user_address=? ${built.where.length ? `AND ${built.where.join(' AND ')}` : ''}
    ORDER BY t.deployment_block DESC, t.first_seen_at DESC LIMIT ? OFFSET ?`;
  return (db.prepare(sql).all(scanId, userAddress.toLowerCase(), ...built.params, limit, offset) as any[]).map(rowToToken);
}

export function saveChallenge(address: string, message: string, expiresAt: number) {
  db.prepare('INSERT INTO auth_challenges(address,message,expires_at) VALUES(?,?,?) ON CONFLICT(address) DO UPDATE SET message=excluded.message,expires_at=excluded.expires_at').run(address.toLowerCase(), message, expiresAt);
}
export function consumeChallenge(address: string) {
  const normalized = address.toLowerCase();
  const tx = db.transaction(() => {
    const row = db.prepare('SELECT message,expires_at FROM auth_challenges WHERE address=?').get(normalized) as { message:string; expires_at:number } | undefined;
    db.prepare('DELETE FROM auth_challenges WHERE address=?').run(normalized);
    return row;
  });
  return tx();
}
export function createAuthSession(tokenHash: string, address: string, expiresAt: number) {
  db.prepare('INSERT INTO auth_sessions(token_hash,address,created_at,expires_at) VALUES(?,?,?,?)').run(tokenHash, address.toLowerCase(), Date.now(), expiresAt);
}
export function getAuthSession(tokenHash: string) {
  db.prepare('DELETE FROM auth_sessions WHERE expires_at<=?').run(Date.now());
  return db.prepare('SELECT address,expires_at FROM auth_sessions WHERE token_hash=?').get(tokenHash) as { address:string; expires_at:number } | undefined;
}
export function deleteAuthSession(tokenHash: string) { db.prepare('DELETE FROM auth_sessions WHERE token_hash=?').run(tokenHash); }

function rowToScan(r: any): ScanSession {
  return { id:r.id, userAddress:r.user_address, mode:r.mode, durationMinutes:r.duration_minutes, lookbackMinutes:r.lookback_minutes,
    startedAt:r.started_at, endsAt:r.ends_at, completedAt:r.completed_at, status:r.status, fromBlock:r.from_block, toBlock:r.to_block,
    scannedBlocks:r.scanned_blocks, totalBlocks:r.total_blocks, resultCount:r.result_count ?? 0, error:r.error };
}
export function createScanSession(input: { id:string; userAddress:string; mode:'live'|'history'; durationMinutes?:number; lookbackMinutes?:number; endsAt?:number }) {
  db.prepare(`INSERT INTO scan_sessions(id,user_address,mode,duration_minutes,lookback_minutes,started_at,ends_at,status) VALUES(?,?,?,?,?,?,?,'running')`).run(
    input.id, input.userAddress.toLowerCase(), input.mode, input.durationMinutes ?? null, input.lookbackMinutes ?? null, Date.now(), input.endsAt ?? null
  );
  return getScanSession(input.id, input.userAddress)!;
}
export function getScanSession(id: string, userAddress: string) {
  const row = db.prepare(`SELECT s.*,(SELECT COUNT(*) FROM scan_results r WHERE r.scan_id=s.id) result_count FROM scan_sessions s WHERE s.id=? AND s.user_address=?`).get(id,userAddress.toLowerCase());
  return row ? rowToScan(row) : null;
}
export function listScanSessions(userAddress: string, limit = 50) {
  expireLiveScans();
  return (db.prepare(`SELECT s.*,(SELECT COUNT(*) FROM scan_results r WHERE r.scan_id=s.id) result_count FROM scan_sessions s WHERE s.user_address=? ORDER BY s.started_at DESC LIMIT ?`).all(userAddress.toLowerCase(),limit) as any[]).map(rowToScan);
}
export function deleteScanSession(id:string,userAddress:string) {
  const normalized=userAddress.toLowerCase();
  const scan=db.prepare('SELECT status FROM scan_sessions WHERE id=? AND user_address=?').get(id,normalized) as {status:string}|undefined;
  if(!scan)return {deleted:false,reason:'not_found' as const};
  if(scan.status==='running')return {deleted:false,reason:'running' as const};
  const result=db.prepare('DELETE FROM scan_sessions WHERE id=? AND user_address=?').run(id,normalized);
  return {deleted:result.changes>0,reason:null};
}
export function updateScanSession(id:string, patch:{ status?:string; completedAt?:number|null; fromBlock?:number; toBlock?:number; scannedBlocks?:number; totalBlocks?:number; error?:string|null }) {
  const pairs: string[]=[]; const values:unknown[]=[];
  const mapping:Record<string,string>={status:'status',completedAt:'completed_at',fromBlock:'from_block',toBlock:'to_block',scannedBlocks:'scanned_blocks',totalBlocks:'total_blocks',error:'error'};
  for (const [key,column] of Object.entries(mapping)) {
    const value=(patch as any)[key];
    if (key in patch && value !== undefined) { pairs.push(`${column}=?`); values.push(value); }
  }
  if (pairs.length) db.prepare(`UPDATE scan_sessions SET ${pairs.join(',')} WHERE id=?`).run(...values,id);
}
export function attachTokenToScan(scanId:string, tokenAddress:string) {
  db.prepare('INSERT OR IGNORE INTO scan_results(scan_id,token_address,discovered_at) VALUES(?,?,?)').run(scanId,tokenAddress.toLowerCase(),Date.now());
}
export function attachTokenToActiveLiveScans(tokenAddress:string) {
  expireLiveScans();
  const rows=db.prepare("SELECT id FROM scan_sessions WHERE mode='live' AND status='running' AND ends_at>?").all(Date.now()) as Array<{id:string}>;
  const insert=db.prepare('INSERT OR IGNORE INTO scan_results(scan_id,token_address,discovered_at) VALUES(?,?,?)');
  db.transaction(()=>rows.forEach(row=>insert.run(row.id,tokenAddress.toLowerCase(),Date.now())))();
}
export function expireLiveScans() {
  db.prepare("UPDATE scan_sessions SET status='complete',completed_at=COALESCE(completed_at,ends_at) WHERE mode='live' AND status='running' AND ends_at<=?").run(Date.now());
}
export function stopLiveScan(id:string,userAddress:string) {
  const result=db.prepare("UPDATE scan_sessions SET status='stopped',completed_at=? WHERE id=? AND user_address=? AND mode='live' AND status='running'").run(Date.now(),id,userAddress.toLowerCase());
  return result.changes>0;
}
export function latestActiveLiveEnd() {
  expireLiveScans();
  const row=db.prepare("SELECT MAX(ends_at) value FROM scan_sessions WHERE mode='live' AND status='running'").get() as {value:number|null};
  return row.value;
}
export function activeLiveScanForUser(userAddress:string) {
  expireLiveScans();
  const row=db.prepare(`SELECT s.*,(SELECT COUNT(*) FROM scan_results r WHERE r.scan_id=s.id) result_count FROM scan_sessions s WHERE user_address=? AND mode='live' AND status='running' ORDER BY started_at DESC LIMIT 1`).get(userAddress.toLowerCase());
  return row ? rowToScan(row) : null;
}
export function stats() {
  const tokenCount = (db.prepare('SELECT COUNT(*) c FROM tokens').get() as any).c as number;
  const poolCount = (db.prepare('SELECT COUNT(*) c FROM pools').get() as any).c as number;
  const highRiskCount = (db.prepare("SELECT COUNT(*) c FROM tokens WHERE risk_label IN ('HIGH','CRITICAL')").get() as any).c as number;
  return { tokenCount, poolCount, highRiskCount };
}
