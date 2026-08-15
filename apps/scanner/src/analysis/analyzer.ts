import type { Warning } from '@sentinel/shared';
import { zeroAddress } from 'viem';
import { client } from '../chain/client.js';
import { erc20Abi } from '../chain/abis.js';
import { getSourceInfo } from './blockscout.js';
import { analyzeSource } from './staticRisk.js';
import { looksLikeMinimalProxy, scanOpcodes } from './bytecode.js';
import { analyzeHolders } from './holders.js';
import { probeTaxes } from './taxes.js';
import { getToken, updateToken, upsertPool } from '../db/repository.js';
import { scoreRisk } from './riskScore.js';
import { publish } from '../events.js';
import { getMarketData } from './marketData.js';

export async function readErc20Metadata(address: `0x${string}`) {
  const calls = await Promise.allSettled([
    client.readContract({ address, abi: erc20Abi, functionName:'name' }),
    client.readContract({ address, abi: erc20Abi, functionName:'symbol' }),
    client.readContract({ address, abi: erc20Abi, functionName:'decimals' }),
    client.readContract({ address, abi: erc20Abi, functionName:'totalSupply' })
  ]);
  const val = <T>(i:number): T|null => calls[i]?.status === 'fulfilled' ? calls[i].value as T : null;
  const name = val<string>(0), symbol = val<string>(1), decimalsRaw = val<number | bigint>(2), totalSupply = val<bigint>(3);
  const decimals = decimalsRaw == null ? null : Number(decimalsRaw);
  const standardSignals = [name != null, symbol != null, decimals != null, totalSupply != null].filter(Boolean).length;
  if (totalSupply == null || standardSignals < 2) return null;
  return { name, symbol, decimals, totalSupply };
}

async function readOwner(address: `0x${string}`) {
  try { return await client.readContract({ address, abi: erc20Abi, functionName:'owner' }) as `0x${string}`; } catch { return null; }
}

export async function analyzeToken(addressRaw: string) {
  const address = addressRaw.toLowerCase() as `0x${string}`;
  const token = getToken(address);
  if (!token) return;
  updateToken(address, { analysisState:'analyzing' }); publish('token:update', { address, analysisState:'analyzing' });
  const warnings: Warning[] = [];
  try {
    const [code, source, owner, latestBlock, market] = await Promise.all([
      client.getBytecode({ address }), getSourceInfo(address), readOwner(address), client.getBlockNumber(), getMarketData(address)
    ]);
    const flags = scanOpcodes(code);
    const minimalProxy = looksLikeMinimalProxy(code);
    warnings.push(...analyzeSource(source.source, source.abi));
    if (flags.includes('DELEGATECALL')) warnings.push({ code:'DELEGATECALL_BYTECODE', title:'Delegatecall opcode', severity:'high', detail:'Runtime bytecode contains DELEGATECALL. This is common in proxies but means logic may live elsewhere.' });
    if (flags.includes('SELFDESTRUCT')) warnings.push({ code:'SELFDESTRUCT_BYTECODE', title:'Selfdestruct opcode', severity:'medium', detail:'Runtime bytecode contains SELFDESTRUCT. Modern EVM semantics limit its effects, but it is still notable.' });
    if (minimalProxy || source.proxy) warnings.push({ code:'PROXY', title:'Proxy/upgradeability detected', severity:'high', detail: source.implementation ? `Contract is reported as a proxy with implementation ${source.implementation}.` : 'Proxy-like runtime bytecode or explorer metadata was detected.' });
    if (!source.verified) warnings.push({ code:'UNVERIFIED', title:'Source code not verified', severity:'medium', detail:'Blockscout did not return verified source code, reducing the depth of static review.' });
    if (owner && owner !== zeroAddress) warnings.push({ code:'OWNER_ACTIVE', title:'Privileged owner is active', severity:'medium', detail:`owner() currently returns ${owner}. Ownership has not been renounced.` });
    const taxes = await probeTaxes(address, source.abi); warnings.push(...taxes.warnings);

    const poolAddresses = token.pools.map(p => p.address);
    let holderResult = null;
    if (token.totalSupply) {
      try { holderResult = await analyzeHolders(address, BigInt(token.deploymentBlock), latestBlock, BigInt(token.totalSupply), poolAddresses); }
      catch (e) { warnings.push({ code:'HOLDER_PARTIAL', title:'Holder analysis incomplete', severity:'info', detail:`Transfer-log holder reconstruction could not complete: ${e instanceof Error ? e.message : String(e)}` }); }
    }
    if (holderResult?.truncated) warnings.push({ code:'HOLDER_TRUNCATED', title:'Holder data is partial', severity:'info', detail:'Transfer-log reconstruction hit its configured lookback/log limit. Concentration figures may be incomplete.' });
    const concentration = holderResult?.circulatingTop5Percent ?? holderResult?.top5Percent ?? null;
    if (concentration != null && concentration >= 75) warnings.push({ code:'TOP5_CRITICAL', title:'Extreme holder concentration', severity:'critical', detail:`Top five circulating holders control approximately ${concentration.toFixed(2)}% of reconstructed circulating balances.` });
    else if (concentration != null && concentration >= 50) warnings.push({ code:'TOP5_HIGH', title:'High holder concentration', severity:'high', detail:`Top five circulating holders control approximately ${concentration.toFixed(2)}% of reconstructed circulating balances.` });
    else if (concentration != null && concentration >= 30) warnings.push({ code:'TOP5_MODERATE', title:'Concentrated ownership', severity:'medium', detail:`Top five circulating holders control approximately ${concentration.toFixed(2)}% of reconstructed circulating balances.` });

    const result = scoreRisk(warnings);
    if(market.pair)upsertPool({...market.pair,factory:null,fee:null,createdBlock:null,createdTx:null});
    updateToken(address, {
      analysisState: source.verified ? 'complete' : 'partial', riskScore: result.score, riskLabel: result.label, warnings: result.warnings,
      verified: source.verified, sourceAvailable: Boolean(source.source), owner, ownershipRenounced: owner ? owner === zeroAddress : null, buyTax: taxes.buyTax, sellTax: taxes.sellTax,
      top5Percent: holderResult?.top5Percent ?? null, circulatingTop5Percent: holderResult?.circulatingTop5Percent ?? null,
      holderCountEstimate: holderResult?.holderCountEstimate ?? null, marketCapUsd:market.marketCapUsd, liquidityUsd:market.liquidityUsd,
      topHolders: holderResult?.holders ?? [], bytecodeFlags: flags, updatedAt: Date.now()
    });
    publish('token:update', getToken(address));
  } catch (e) {
    warnings.push({ code:'ANALYSIS_ERROR', title:'Analysis error', severity:'info', detail:e instanceof Error ? e.message : String(e) });
    const result = scoreRisk(warnings);
    updateToken(address, { analysisState:'failed', warnings:result.warnings, riskScore:result.score, riskLabel:result.label, updatedAt:Date.now() });
    publish('token:update', getToken(address));
  }
}
