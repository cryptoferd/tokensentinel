import { config } from '../config.js';

export interface SourceInfo {
  verified: boolean;
  source: string | null;
  abi: unknown[] | null;
  contractName: string | null;
  proxy: boolean | null;
  implementation: string | null;
}

export async function getSourceInfo(address: string): Promise<SourceInfo> {
  const url = new URL(config.BLOCKSCOUT_API_URL);
  url.searchParams.set('module', 'contract');
  url.searchParams.set('action', 'getsourcecode');
  url.searchParams.set('address', address);
  try {
    const res = await fetch(url, { signal: AbortSignal.timeout(12_000) });
    if (!res.ok) throw new Error(`Blockscout ${res.status}`);
    const body = await res.json() as any;
    const item = Array.isArray(body?.result) ? body.result[0] : null;
    if (!item || typeof item !== 'object') return { verified: false, source: null, abi: null, contractName: null, proxy: null, implementation: null };
    const source = String(item.SourceCode ?? item.sourceCode ?? '').trim() || null;
    const abiRaw = item.ABI ?? item.abi;
    let abi: unknown[] | null = null;
    if (typeof abiRaw === 'string' && abiRaw && !abiRaw.startsWith('Contract source')) {
      try { abi = JSON.parse(abiRaw); } catch { /* ignored */ }
    } else if (Array.isArray(abiRaw)) abi = abiRaw;
    const impl = String(item.Implementation ?? item.implementation ?? '').trim() || null;
    const proxyRaw = item.Proxy ?? item.proxy;
    return {
      verified: Boolean(source), source, abi, contractName: String(item.ContractName ?? item.contractName ?? '').trim() || null,
      proxy: proxyRaw == null ? null : String(proxyRaw) === '1' || proxyRaw === true, implementation: impl
    };
  } catch {
    return { verified: false, source: null, abi: null, contractName: null, proxy: null, implementation: null };
  }
}
