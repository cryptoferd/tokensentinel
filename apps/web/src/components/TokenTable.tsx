import type { TokenRecord } from '@sentinel/shared';
import { Check, CircleAlert, Droplets, LoaderCircle } from 'lucide-react';
import { RiskBadge } from './RiskBadge';
const short=(s:string|null)=>s?`${s.slice(0,6)}…${s.slice(-4)}`:'—';
const age=(t:number)=>{const s=Math.max(0,Math.floor((Date.now()-t)/1000));if(s<60)return`${s}s`;if(s<3600)return`${Math.floor(s/60)}m`;if(s<86400)return`${Math.floor(s/3600)}h`;return`${Math.floor(s/86400)}d`;};
export function TokenTable({tokens,onSelect}:{tokens:TokenRecord[];onSelect:(t:TokenRecord)=>void}) {
 return <div className="table-wrap"><table><thead><tr><th>Age</th><th>Token</th><th>Contract</th><th>Top 5</th><th>LP</th><th>Analysis</th><th>Risk</th></tr></thead><tbody>{tokens.map(t=><tr key={t.address} onClick={()=>onSelect(t)}>
  <td className="mono dim">{age(t.firstSeenAt)}</td><td><strong>{t.symbol||'???'}</strong><span className="token-name">{t.name||'Unknown token'}</span></td><td className="mono">{short(t.address)}</td>
  <td>{t.circulatingTop5Percent!=null?`${t.circulatingTop5Percent.toFixed(1)}%`:'—'}</td><td>{t.poolCreated?<span className="ok"><Droplets size={14}/> YES</span>:<span className="dim">—</span>}</td>
  <td>{t.analysisState==='analyzing'||t.analysisState==='queued'?<span className="scanning"><LoaderCircle size={14}/> {t.analysisState}</span>:t.warnings.length?<span className="warn"><CircleAlert size={14}/>{t.warnings.length}</span>:<span className="ok"><Check size={14}/> clear</span>}</td>
  <td><RiskBadge label={t.riskLabel} score={t.riskScore}/></td></tr>)}</tbody></table>{!tokens.length&&<div className="empty">No tokens detected yet. The scanner will populate this table as new ERC-20 contracts are deployed.</div>}</div>;
}
