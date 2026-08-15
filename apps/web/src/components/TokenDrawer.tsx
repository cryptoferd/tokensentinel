import type { TokenRecord } from '@sentinel/shared';
import { ExternalLink, RefreshCw, X, Copy, CheckCircle2, AlertTriangle } from 'lucide-react';
import { useState } from 'react';
import { RiskBadge } from './RiskBadge';
import { rescan } from '../lib/api';
const EXP='https://robinhoodchain.blockscout.com';
const fmt=(v:number|null)=>v==null?'Unknown':`${v.toFixed(2)}%`;
const money=(v:number|null)=>v==null?'Unknown':new Intl.NumberFormat('en-US',{style:'currency',currency:'USD',maximumFractionDigits:0}).format(v);
export function TokenDrawer({token,onClose}:{token:TokenRecord|null;onClose:()=>void}){
 const [copied,setCopied]=useState(false); if(!token)return null;
 const copy=()=>{navigator.clipboard.writeText(token.address);setCopied(true);setTimeout(()=>setCopied(false),1000)};
 return <div className="overlay" onClick={onClose}><aside className="drawer" onClick={e=>e.stopPropagation()}><button className="icon close" onClick={onClose}><X/></button>
  <div className="drawer-head"><div className="eyebrow">TOKEN ANALYSIS</div><h2>{token.name||'Unknown'} <span>${token.symbol||'???'}</span></h2><button className="address" onClick={copy}>{token.address}<Copy size={14}/>{copied&&<em>copied</em>}</button><div className="big-risk"><RiskBadge label={token.riskLabel} score={token.riskScore}/></div></div>
  <section className="metrics"><div><label>Market cap</label><strong>{money(token.marketCapUsd)}</strong></div><div><label>Liquidity</label><strong>{money(token.liquidityUsd)}</strong></div><div><label>Holders</label><strong>{token.holderCountEstimate??'—'}</strong></div><div><label>Top 5 raw</label><strong>{fmt(token.top5Percent)}</strong></div><div><label>Top 5 circulating</label><strong>{fmt(token.circulatingTop5Percent)}</strong></div><div><label>Buy tax</label><strong>{fmt(token.buyTax)}</strong></div><div><label>Sell tax</label><strong>{fmt(token.sellTax)}</strong></div><div><label>LP created</label><strong>{token.poolCreated?'YES':'NO'}</strong></div><div><label>Source verified</label><strong>{token.verified===true?'YES':token.verified===false?'NO':'UNKNOWN'}</strong></div><div><label>Owner</label><strong className="mono small">{token.owner?`${token.owner.slice(0,8)}…${token.owner.slice(-5)}`:'Unknown'}</strong></div></section>
  <section><div className="section-title">Warnings <span>{token.warnings.length}</span></div>{token.warnings.length?<div className="warning-list">{token.warnings.map(w=><article className={`warning ${w.severity}`} key={w.code}><AlertTriangle size={18}/><div><b>{w.title}</b><p>{w.detail}</p>{w.evidence&&<code>{w.evidence}</code>}</div></article>)}</div>:<div className="clear-card"><CheckCircle2/> No detected warnings. This is not a guarantee that the contract is safe.</div>}</section>
  {token.pools.length>0&&<section><div className="section-title">Liquidity pools <span>{token.pools.length}</span></div>{token.pools.map(p=><a className="pool" key={p.address} href={`${EXP}/address/${p.address}`} target="_blank"><span>{p.protocol.toUpperCase()}</span><code>{p.address}</code>{p.fee!=null&&<i>fee {p.fee}</i>}<ExternalLink size={15}/></a>)}</section>}
  {token.topHolders.length>0&&<section><div className="section-title">Top reconstructed holders</div>{token.topHolders.map((h,i)=><div className="holder" key={h.address}><span>#{i+1}</span><a href={`${EXP}/address/${h.address}`} target="_blank">{h.address.slice(0,10)}…{h.address.slice(-6)}</a><b>{h.percent.toFixed(2)}%</b>{h.excluded&&<em>{h.label||'excluded'}</em>}</div>)}</section>}
  <div className="drawer-actions"><a href={`${EXP}/address/${token.address}`} target="_blank">Explorer <ExternalLink size={15}/></a><button onClick={()=>rescan(token.address)}><RefreshCw size={15}/> Rescan</button></div>
 </aside></div>;
}
