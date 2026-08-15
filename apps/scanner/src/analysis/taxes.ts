import type { Warning } from '@sentinel/shared';
import { getClient } from '../chain/chains.js';

interface FnAbi { type?: string; name?: string; stateMutability?: string; inputs?: unknown[]; outputs?: unknown[] }
const buyRe = /(buy.*(tax|fee)|(tax|fee).*buy)/i;
const sellRe = /(sell.*(tax|fee)|(tax|fee).*sell)/i;
const denomRe = /(tax|fee).*(denom|divisor)|denom.*(tax|fee)|feeDenominator|taxDenominator/i;

async function callUint(chainKey:string,address: `0x${string}`, fn: FnAbi): Promise<bigint | null> {
  try {
    const abi = [fn] as any;
    const value = await getClient(chainKey).readContract({ address, abi, functionName: fn.name! } as any);
    return typeof value === 'bigint' ? value : typeof value === 'number' ? BigInt(value) : null;
  } catch { return null; }
}

export async function probeTaxes(chainKey:string,address: `0x${string}`, abi: unknown[] | null) {
  if (!abi) return { buyTax: null as number|null, sellTax: null as number|null, warnings: [] as Warning[], evidence: [] as string[] };
  const funcs = (abi as FnAbi[]).filter(x => x?.type === 'function' && x.name && (x.inputs?.length ?? 0) === 0 && (x.outputs?.length ?? 0) === 1);
  const denomFn = funcs.find(x => denomRe.test(x.name!));
  const denom = denomFn ? await callUint(chainKey,address, denomFn) : null;
  async function find(re: RegExp) {
    for (const fn of funcs.filter(x => re.test(x.name!)).slice(0,6)) {
      const raw = await callUint(chainKey,address, fn);
      if (raw == null) continue;
      let percent: number | null = null;
      if (denom && denom > 0n) percent = Number(raw * 1_000_000n / denom) / 10_000;
      else if (raw <= 100n) percent = Number(raw);
      else if (raw <= 10_000n) percent = Number(raw) / 100;
      if (percent != null) return { percent, fn: fn.name!, raw: raw.toString(), denominator: denom?.toString() ?? null };
    }
    return null;
  }
  const [buy, sell] = await Promise.all([find(buyRe), find(sellRe)]);
  const warnings: Warning[] = [];
  const add = (kind:'Buy'|'Sell', result: typeof buy) => {
    if (!result) return;
    const p = result.percent;
    if (p >= 50) warnings.push({ code:`${kind.toUpperCase()}_TAX_CRITICAL`, title:`Very high ${kind.toLowerCase()} tax`, severity:'critical', detail:`A ${kind.toLowerCase()} tax/fee getter currently resolves to approximately ${p.toFixed(2)}%.`, evidence:`${result.fn}=${result.raw}${result.denominator ? `, denominator=${result.denominator}` : ' (normalization heuristic)'}` });
    else if (p >= 10) warnings.push({ code:`${kind.toUpperCase()}_TAX_HIGH`, title:`High ${kind.toLowerCase()} tax`, severity:'high', detail:`A ${kind.toLowerCase()} tax/fee getter currently resolves to approximately ${p.toFixed(2)}%.`, evidence:`${result.fn}=${result.raw}${result.denominator ? `, denominator=${result.denominator}` : ' (normalization heuristic)'}` });
  };
  add('Buy', buy); add('Sell', sell);
  return { buyTax: buy?.percent ?? null, sellTax: sell?.percent ?? null, warnings, evidence: [buy,sell].filter(Boolean).map(x => `${x!.fn}=${x!.raw}`) };
}
