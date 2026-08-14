import { useCallback, useEffect, useMemo, useState } from 'react';
import type { Stats, TokenRecord } from '@sentinel/shared';
import { Activity, Database, Search, ShieldCheck, Square, Timer, TriangleAlert, Wifi } from 'lucide-react';
import { fetchStats, fetchTokens, startScanner, stopScanner } from './lib/api';
import { useLive } from './hooks/useLive';
import { TokenTable } from './components/TokenTable';
import { TokenDrawer } from './components/TokenDrawer';

const DEFAULT_DURATION = 15;

function formatRemaining(milliseconds: number) {
  const totalSeconds = Math.max(0, Math.ceil(milliseconds / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2,'0')}:${String(seconds).padStart(2,'0')}`;
}

export default function App(){
  const [tokens,setTokens]=useState<TokenRecord[]>([]);
  const [stats,setStats]=useState<Stats|null>(null);
  const [selected,setSelected]=useState<TokenRecord|null>(null);
  const [q,setQ]=useState('');
  const [error,setError]=useState('');
  const [duration,setDuration]=useState(DEFAULT_DURATION);
  const [busy,setBusy]=useState(false);
  const [now,setNow]=useState(Date.now());

  const refresh=useCallback(async()=>{
    try{
      const [t,s]=await Promise.all([fetchTokens(q),fetchStats()]);
      setTokens(t); setStats(s); setError('');
      if(selected){const n=t.find(x=>x.address===selected.address);if(n)setSelected(n)}
    }catch(e){setError(e instanceof Error?e.message:String(e))}
  },[q,selected?.address]);

  useEffect(()=>{void refresh();const i=setInterval(()=>void refresh(),6000);return()=>clearInterval(i)},[refresh]);
  useEffect(()=>{const i=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(i)},[]);
  useLive(refresh);

  const remaining = useMemo(
    () => stats?.scannerRunning && stats.scannerEndsAt ? Math.max(0, stats.scannerEndsAt-now) : 0,
    [stats?.scannerRunning,stats?.scannerEndsAt,now]
  );

  async function handleStart(){
    setBusy(true); setError('');
    try{await startScanner(duration);await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }

  async function handleStop(){
    setBusy(true); setError('');
    try{await stopScanner();await refresh()}catch(e){setError(e instanceof Error?e.message:String(e))}finally{setBusy(false)}
  }

  return <main>
    <header>
      <div className="brand"><div className="mark"><ShieldCheck/></div><div><h1>ROBINHOOD TOKEN SENTINEL</h1><p>Timed launch monitor + contract risk scanner</p></div></div>
      <div className={`live ${stats?.scannerRunning?'on':''}`}><Wifi size={15}/>{stats?.scannerRunning?'SCANNING':'READY'} <span>CHAIN 4663</span></div>
    </header>
    <div className="content">
      <section className="hero">
        <div><div className="eyebrow">ROBINHOOD CHAIN / MAINNET</div><h2>See new tokens.<br/><span>Know the risk.</span></h2><p>Run focused monitoring sessions when you want them. Newly deployed ERC-20s, liquidity pools, holder concentration and contract capabilities are analyzed automatically.</p></div>
        <div className="block-card"><span>SCANNED BLOCK</span><strong>{stats?.scannedBlock?.toLocaleString()||'—'}</strong><small>tip {stats?.latestBlock?.toLocaleString()||'—'}</small></div>
      </section>

      <section className={`scan-control ${stats?.scannerRunning?'active':''}`}>
        <div className="scan-copy">
          <div className="scan-icon"><Timer/></div>
          <div><span>TIMED LIVE SCAN</span><h3>{stats?.scannerRunning?'Monitoring new launches':'Choose a scan window'}</h3><p>{stats?.scannerRunning?'The scanner stops automatically when the countdown reaches zero.':'Monitoring begins at the current chain tip and runs only for the selected time.'}</p></div>
        </div>
        <div className="scan-settings">
          {stats?.scannerRunning ? <div className="countdown"><span>TIME REMAINING</span><strong>{formatRemaining(remaining)}</strong></div> : <>
            <div className="duration-readout"><span>DURATION</span><strong>{duration}<small> MIN</small></strong></div>
            <div className="range-wrap"><input aria-label="Scan duration in minutes" type="range" min="5" max="60" step="5" value={duration} onChange={e=>setDuration(Number(e.target.value))}/><div><span>5 MIN</span><span>1 HOUR</span></div></div>
          </>}
          <button className={`scan-button ${stats?.scannerRunning?'stop':''}`} disabled={busy} onClick={stats?.scannerRunning?handleStop:handleStart}>{stats?.scannerRunning?<><Square size={15}/>STOP SCAN</>:<><Activity size={16}/>START SCAN</>}</button>
        </div>
      </section>

      <section className="stats"><div><Activity/><span>Tokens detected</span><strong>{stats?.tokenCount??0}</strong></div><div><Database/><span>Pools detected</span><strong>{stats?.poolCount??0}</strong></div><div><TriangleAlert/><span>High / critical</span><strong>{stats?.highRiskCount??0}</strong></div><div><ShieldCheck/><span>Analysis queue</span><strong>{stats?.queueDepth??0}</strong></div></section>
      <section className="panel"><div className="toolbar"><div><h3>NEW LAUNCHES</h3><span>Newest contracts first</span></div><label className="search"><Search size={17}/><input value={q} onChange={e=>setQ(e.target.value)} placeholder="Search address, name, symbol"/></label></div>{error&&<div className="api-error">{error}</div>}<TokenTable tokens={tokens} onSelect={setSelected}/></section>
      <footer><p>Heuristic research tool — not financial advice and not a guarantee of contract safety.</p><p>Robinhood Chain · Chain ID 4663</p></footer>
    </div>
    <TokenDrawer token={selected} onClose={()=>setSelected(null)}/>
  </main>;
}
