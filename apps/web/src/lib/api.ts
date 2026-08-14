import type { Stats, TokenRecord } from '@sentinel/shared';
export const API = (import.meta.env.VITE_API_URL || 'http://localhost:8787').replace(/\/$/,'');
export async function fetchTokens(q='') { const r=await fetch(`${API}/api/tokens?limit=100${q?`&q=${encodeURIComponent(q)}`:''}`); if(!r.ok) throw new Error('API unavailable'); return (await r.json()).items as TokenRecord[]; }
export async function fetchStats() { const r=await fetch(`${API}/api/stats`); if(!r.ok) throw new Error('API unavailable'); return r.json() as Promise<Stats>; }
export async function fetchToken(address:string) { const r=await fetch(`${API}/api/tokens/${address}`); if(!r.ok) throw new Error('Token unavailable'); return r.json() as Promise<TokenRecord>; }
export async function rescan(address:string) { await fetch(`${API}/api/tokens/${address}/rescan`,{method:'POST'}); }
