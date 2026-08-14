import type { AnalysisState, Holder, PoolInfo, TokenRecord, Warning } from '@sentinel/shared';
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
  db.prepare(`INSERT INTO tokens(address,name,symbol,decimals,total_supply,deployer,deployment_tx,deployment_block,first_seen_at,analysis_state,risk_score,risk_label,verified,source_available,owner,ownership_renounced,buy_tax,sell_tax,top5_percent,circulating_top5_percent,holder_count_estimate,warnings_json,bytecode_flags_json,top_holders_json,updated_at)
  VALUES(@address,@name,@symbol,@decimals,@totalSupply,@deployer,@deploymentTx,@deploymentBlock,@firstSeenAt,@analysisState,@riskScore,@riskLabel,@verified,@sourceAvailable,@owner,@ownershipRenounced,@buyTax,@sellTax,@top5Percent,@circulatingTop5Percent,@holderCountEstimate,@warnings,@flags,@holders,@updatedAt)
  ON CONFLICT(address) DO UPDATE SET
    name=COALESCE(excluded.name,tokens.name), symbol=COALESCE(excluded.symbol,tokens.symbol), decimals=COALESCE(excluded.decimals,tokens.decimals),
    total_supply=COALESCE(excluded.total_supply,tokens.total_supply), deployer=COALESCE(excluded.deployer,tokens.deployer), deployment_tx=COALESCE(excluded.deployment_tx,tokens.deployment_tx),
    analysis_state=excluded.analysis_state, risk_score=excluded.risk_score, risk_label=excluded.risk_label, verified=COALESCE(excluded.verified,tokens.verified),
    source_available=COALESCE(excluded.source_available,tokens.source_available), owner=COALESCE(excluded.owner,tokens.owner), ownership_renounced=COALESCE(excluded.ownership_renounced,tokens.ownership_renounced), buy_tax=COALESCE(excluded.buy_tax,tokens.buy_tax), sell_tax=COALESCE(excluded.sell_tax,tokens.sell_tax),
    top5_percent=COALESCE(excluded.top5_percent,tokens.top5_percent), circulating_top5_percent=COALESCE(excluded.circulating_top5_percent,tokens.circulating_top5_percent),
    holder_count_estimate=COALESCE(excluded.holder_count_estimate,tokens.holder_count_estimate), warnings_json=excluded.warnings_json, bytecode_flags_json=excluded.bytecode_flags_json,
    top_holders_json=excluded.top_holders_json, updated_at=excluded.updated_at`).run({
      address: input.address.toLowerCase(), name: input.name ?? null, symbol: input.symbol ?? null, decimals: input.decimals ?? null,
      totalSupply: input.totalSupply ?? null, deployer: input.deployer?.toLowerCase() ?? null, deploymentTx: input.deploymentTx ?? null,
      deploymentBlock: input.deploymentBlock, firstSeenAt: input.firstSeenAt, analysisState: input.analysisState ?? 'queued', riskScore: input.riskScore ?? 0,
      riskLabel: input.riskLabel ?? 'LOW', verified: input.verified == null ? null : Number(input.verified), sourceAvailable: input.sourceAvailable == null ? null : Number(input.sourceAvailable),
      owner: input.owner?.toLowerCase() ?? null, ownershipRenounced: input.ownershipRenounced == null ? null : Number(input.ownershipRenounced), buyTax: input.buyTax ?? null, sellTax: input.sellTax ?? null, top5Percent: input.top5Percent ?? null,
      circulatingTop5Percent: input.circulatingTop5Percent ?? null, holderCountEstimate: input.holderCountEstimate ?? null,
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
    circulatingTop5Percent: r.circulating_top5_percent, holderCountEstimate: r.holder_count_estimate, poolCreated: pools.length > 0, pools,
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
export function stats() {
  const tokenCount = (db.prepare('SELECT COUNT(*) c FROM tokens').get() as any).c as number;
  const poolCount = (db.prepare('SELECT COUNT(*) c FROM pools').get() as any).c as number;
  const highRiskCount = (db.prepare("SELECT COUNT(*) c FROM tokens WHERE risk_label IN ('HIGH','CRITICAL')").get() as any).c as number;
  return { tokenCount, poolCount, highRiskCount };
}
