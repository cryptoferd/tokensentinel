import { useCallback, useEffect, useState } from 'react';
import type { Stats, TokenRecord } from '@sentinel/shared';
import { Activity, Database, Search, ShieldCheck, TriangleAlert, Wifi } from 'lucide-react';
import { fetchStats, fetchTokens } from './lib/api';
import { useLive } from './hooks/useLive';
import { TokenTable } from './components/TokenTable';
import { TokenDrawer } from './components/TokenDrawer';

export default function App(){
 const [tokens,setTokens]=useState<TokenRecord[]>([]),[stats,setStats]=useState<Stats|null>(null),[selected,setSelected]=useState<TokenRecord|null>(null),[q,setQ]=useState(''),[error,setError]=useState('');
 const refresh=useCallback(async()=>{try{const [t,s]=await Promise.all([fetchTokens(q),fetchStats()]);setTokens(t);setStats(s);setError('');if(selected){const n=t.find(x=>x.address===selected.address);if(n)setSelected(n)}}catch(e){setError(e instanceof Error?e.message:String(e))}},[q,selected?.address]);
 useEffect(()=>{void refresh();const i=setInterval(()=>void refresh(),6000);return()=>clearInterval(i)},[refresh]); useLive(refresh);
 return <main><header><div className="brand"><div className="mark"><ShieldCheck/></div><div><h1>ROBINHOOD TOKEN SENTINEL</h1><p>Launch monitor + contract risk scanner</p></div></div><div className={`live ${stats?.scannerRunning?'on':''}`}><Wifi size={15}/>{stats?.scannerRunning?'LIVE':'OFFLINE'} <span>CHAIN 4663</span></div></header>
 <div className="content"><section className="hero"><div><div className="eyebrow">ROBINHOOD CHAIN / MAINNET</div><h2>See new tokens.<br/><span>Know the risk.</span></h2><p>Real-time ERC-20 deployment discovery, liquidity-pool detection, holder concentration and contract capability analysis.</p></div><div className="block-card"><span>SCANNED BLOCK</span><strong>{stats?.scannedBlock?.toLocaleString()||'—'}</strong><small>tip {stats?.latestBlock?.toLocaleString()||'—'}</small></div></section>
 <section className="stats"><div><Activity/><span>Tokens detected</span><strong>{stats?.tokenCount??0}</strong></div><div><Database/><span>Pools detected</span><strong>{stats?.poolCount??0}</strong></div><div><TriangleAlert/><span>High / critical</span><strong>{stats?.highRiskCount??0}</strong></div><div><ShieldCheck/><span>Analysis queue</span><strong>{stats?.queueDepth??0}</strong></div></section>
 <section className="panel"><div className="toolbar"><div><h3>NEW LAUNCHES</h3><span>Newest contracts first</span></div><label className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search address, name, symbol"/></label></div>{error&&<div className="api-error">{error}. Start the scanner API on port 8787.</div>}<TokenTable tokens={tokens} onSelect={setSelected}/></section>
 <footer><p>Heuristic research tool — not financial advice and not a guarantee of contract safety.</p><p>Robinhood Chain · Chain ID 4663</p></footer></div><TokenDrawer token={selected} onClose={()=>setSelected(null)}/></main>;
}
