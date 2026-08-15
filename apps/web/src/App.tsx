import { useCallback, useEffect, useMemo, useState } from 'react';
import type { ScanSession, Stats, TokenFilters, TokenRecord } from '@sentinel/shared';
import { Activity, Clock3, Database, Filter, History, LogOut, Search, ShieldCheck, Square, Timer, TriangleAlert, Wallet, Wifi } from 'lucide-react';
import { createWalletClient, custom, getAddress } from 'viem';
import { authMe, authNonce, authVerify, clearSessionToken, fetchScanResults, fetchScans, fetchStats, getSessionToken, logout, saveSessionToken, startHistoryScan, startScanner, stopScanner } from './lib/api';
import { TokenTable } from './components/TokenTable';
import { TokenDrawer } from './components/TokenDrawer';

const DEFAULT_DURATION=15;
const WINDOWS=[{label:'5m',value:5},{label:'30m',value:30},{label:'1h',value:60},{label:'3h',value:180},{label:'6h',value:360},{label:'12h',value:720},{label:'24h',value:1440}];
const emptyFilters:TokenFilters={q:'',risk:'',minMarketCap:undefined,maxMarketCap:undefined,minHolders:undefined,maxHolders:undefined,maxTop5:undefined,hasLiquidity:undefined};
const short=(address:string)=>`${address.slice(0,6)}…${address.slice(-4)}`;
const formatRemaining=(ms:number)=>{const seconds=Math.max(0,Math.ceil(ms/1000));return`${String(Math.floor(seconds/60)).padStart(2,'0')}:${String(seconds%60).padStart(2,'0')}`;};
const scanLabel=(scan:ScanSession)=>scan.mode==='live'?`${scan.durationMinutes}m live scan`:`Last ${WINDOWS.find(item=>item.value===scan.lookbackMinutes)?.label??`${scan.lookbackMinutes}m`}`;

function Login({onLogin}:{onLogin:(address:string)=>void}) {
  const [busy,setBusy]=useState(false); const [error,setError]=useState('');
  async function connect(){
    if(!window.ethereum){setError('No injected EVM wallet found. Install MetaMask, Rabby, Coinbase Wallet, or another browser wallet.');return;}
    setBusy(true);setError('');
    try{
      const wallet=createWalletClient({transport:custom(window.ethereum)});
      const [account]=await wallet.requestAddresses(); if(!account)throw new Error('No wallet account selected.');
      const address=getAddress(account); const challenge=await authNonce(address);
      const signature=await wallet.signMessage({account:address,message:challenge.message});
      const session=await authVerify(address,signature); saveSessionToken(session.token); onLogin(session.address);
    }catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);}
  }
  return <main className="login-page"><section className="gate-card"><div className="gate-mark"><ShieldCheck/></div><div className="eyebrow">PRIVATE ACCESS / CROIKEYS HOLDERS</div><h1>ROBINHOOD<br/>TOKEN SENTINEL</h1><p>Connect an EVM wallet and sign a gas-free message. Access is granted only when the wallet holds at least one Croikey on Ethereum.</p><button className="connect-button" onClick={connect} disabled={busy}><Wallet size={18}/>{busy?'VERIFYING WALLET…':'CONNECT & VERIFY WALLET'}</button>{error&&<div className="gate-error">{error}</div>}<small>No transaction or wallet permission beyond message signing is requested.</small></section></main>;
}

export default function App(){
  const [address,setAddress]=useState<string|null>(null); const [authLoading,setAuthLoading]=useState(Boolean(getSessionToken()));
  const [tokens,setTokens]=useState<TokenRecord[]>([]); const [stats,setStats]=useState<Stats|null>(null); const [scans,setScans]=useState<ScanSession[]>([]);
  const [selectedScanId,setSelectedScanId]=useState(''); const [selected,setSelected]=useState<TokenRecord|null>(null);
  const [filters,setFilters]=useState<TokenFilters>(emptyFilters); const [duration,setDuration]=useState(DEFAULT_DURATION); const [busy,setBusy]=useState(false); const [error,setError]=useState(''); const [now,setNow]=useState(Date.now());

  useEffect(()=>{if(!getSessionToken()){setAuthLoading(false);return;}authMe().then(me=>setAddress(me.address)).catch(()=>clearSessionToken()).finally(()=>setAuthLoading(false));},[]);
  const refresh=useCallback(async()=>{
    if(!address)return;
    try{
      const [nextStats,nextScans]=await Promise.all([fetchStats(),fetchScans()]); setStats(nextStats);setScans(nextScans);
      const scanId=selectedScanId||nextScans[0]?.id||''; if(!selectedScanId&&scanId)setSelectedScanId(scanId);
      if(scanId){const result=await fetchScanResults(scanId,filters);setTokens(result.items);}else setTokens([]);
      setError('');
    }catch(error){const message=error instanceof Error?error.message:String(error);setError(message);if(!getSessionToken())setAddress(null);}
  },[address,selectedScanId,JSON.stringify(filters)]);
  useEffect(()=>{void refresh();const timer=setInterval(()=>void refresh(),5000);return()=>clearInterval(timer);},[refresh]);
  useEffect(()=>{const timer=setInterval(()=>setNow(Date.now()),500);return()=>clearInterval(timer);},[]);

  const activeScan=useMemo(()=>scans.find(scan=>scan.mode==='live'&&scan.status==='running')??null,[scans]);
  const selectedScan=scans.find(scan=>scan.id===selectedScanId)??null;
  const remaining=activeScan?.endsAt?Math.max(0,activeScan.endsAt-now):0;
  async function action(work:()=>Promise<unknown>){setBusy(true);setError('');try{await work();await refresh();}catch(error){setError(error instanceof Error?error.message:String(error));}finally{setBusy(false);}}
  const startLive=()=>action(async()=>{const {scan}=await startScanner(duration);setSelectedScanId(scan.id);});
  const stopLive=()=>action(async()=>{await stopScanner(activeScan?.id);});
  const history=(minutes:number)=>action(async()=>{const {scan}=await startHistoryScan(minutes);setSelectedScanId(scan.id);});
  const signOut=()=>action(async()=>{await logout();setAddress(null);setScans([]);setTokens([]);});
  const setNumber=(key:keyof TokenFilters,value:string)=>setFilters(current=>({...current,[key]:value===''?undefined:Number(value)}));

  if(authLoading)return <main className="login-page"><div className="gate-card">Checking wallet session…</div></main>;
  if(!address)return <Login onLogin={setAddress}/>;
  return <main>
    <header><div className="brand"><div className="mark"><ShieldCheck/></div><div><h1>ROBINHOOD TOKEN SENTINEL</h1><p>Croikey-gated launch intelligence</p></div></div><div className="header-actions"><div className={`live ${activeScan?'on':''}`}><Wifi size={15}/>{activeScan?'SCANNING':'READY'} <span>CHAIN 4663</span></div><button className="wallet-pill" onClick={signOut} title="Sign out"><Wallet size={14}/>{short(address)}<LogOut size={13}/></button></div></header>
    <div className="content"><section className="hero"><div><div className="eyebrow">PRIVATE HOLDER DASHBOARD</div><h2>Your scans.<br/><span>Your launch history.</span></h2><p>Run live monitoring or backfill recent Robinhood Chain launches. Every scan and its results are saved privately to your connected wallet.</p></div><div className="block-card"><span>SCANNED BLOCK</span><strong>{stats?.scannedBlock?.toLocaleString()||'—'}</strong><small>tip {stats?.latestBlock?.toLocaleString()||'—'}</small></div></section>
      <section className="scan-grid"><article className={`scan-control ${activeScan?'active':''}`}><div className="scan-copy"><div className="scan-icon"><Timer/></div><div><span>TIMED LIVE SCAN</span><h3>{activeScan?'Monitoring new launches':'Choose a scan duration'}</h3><p>{activeScan?'Results are being saved to your wallet dashboard.':'Begin at the current tip and stop automatically.'}</p></div></div><div className="scan-settings">{activeScan?<div className="countdown"><span>TIME REMAINING</span><strong>{formatRemaining(remaining)}</strong></div>:<><div className="duration-readout"><span>DURATION</span><strong>{duration}<small> MIN</small></strong></div><div className="range-wrap"><input aria-label="Scan duration" type="range" min="5" max="60" step="5" value={duration} onChange={event=>setDuration(Number(event.target.value))}/><div><span>5 MIN</span><span>1 HOUR</span></div></div></>}<button className={`scan-button ${activeScan?'stop':''}`} disabled={busy} onClick={activeScan?stopLive:startLive}>{activeScan?<><Square size={15}/>STOP MY SCAN</>:<><Activity size={16}/>START LIVE SCAN</>}</button></div></article>
        <article className="history-control"><div><span className="control-label"><History size={15}/>HISTORICAL LOOKBACK</span><h3>What launched recently?</h3><p>Backfill a selected chain window. Longer windows continue in the background.</p></div><div className="window-buttons">{WINDOWS.map(item=><button key={item.value} disabled={busy} onClick={()=>history(item.value)}>{item.label}</button>)}</div></article></section>
      <section className="stats"><div><Activity/><span>Selected results</span><strong>{tokens.length}</strong></div><div><Database/><span>Your saved scans</span><strong>{scans.length}</strong></div><div><TriangleAlert/><span>High / critical</span><strong>{tokens.filter(token=>token.riskLabel==='HIGH'||token.riskLabel==='CRITICAL').length}</strong></div><div><ShieldCheck/><span>Analysis queue</span><strong>{stats?.queueDepth??0}</strong></div></section>
      <section className="workspace"><aside className="scan-history"><div className="section-heading"><Clock3 size={15}/><span>SCAN HISTORY</span></div>{scans.map(scan=><button className={scan.id===selectedScanId?'selected':''} key={scan.id} onClick={()=>setSelectedScanId(scan.id)}><span>{scanLabel(scan)}</span><small>{new Date(scan.startedAt).toLocaleString()}</small><em className={`status-${scan.status}`}>{scan.status}{scan.status==='running'&&scan.totalBlocks?` ${Math.round(scan.scannedBlocks/scan.totalBlocks*100)}%`:''} · {scan.resultCount}</em></button>)}{!scans.length&&<p>No saved scans yet.</p>}</aside>
        <section className="panel"><div className="toolbar"><div><h3>{selectedScan?scanLabel(selectedScan).toUpperCase():'SCAN RESULTS'}</h3><span>{selectedScan?.status==='running'&&selectedScan.scannedBlocks?`${selectedScan.scannedBlocks.toLocaleString()} indexed transactions checked`:selectedScan?.error||'Newest contracts first'}</span></div><label className="search"><Search size={17}/><input value={filters.q??''} onChange={event=>setFilters(current=>({...current,q:event.target.value}))} placeholder="Address, name, symbol"/></label></div>
          <div className="filters"><div className="filter-title"><Filter size={14}/>FILTERS</div><label>Risk<select value={filters.risk??''} onChange={event=>setFilters(current=>({...current,risk:event.target.value}))}><option value="">Any</option><option>LOW</option><option>MODERATE</option><option>HIGH</option><option>CRITICAL</option></select></label><label>Min market cap<input type="number" placeholder="$0" value={filters.minMarketCap??''} onChange={event=>setNumber('minMarketCap',event.target.value)}/></label><label>Max market cap<input type="number" placeholder="Any" value={filters.maxMarketCap??''} onChange={event=>setNumber('maxMarketCap',event.target.value)}/></label><label>Min holders<input type="number" placeholder="0" value={filters.minHolders??''} onChange={event=>setNumber('minHolders',event.target.value)}/></label><label>Max Top 5 %<input type="number" placeholder="100" value={filters.maxTop5??''} onChange={event=>setNumber('maxTop5',event.target.value)}/></label><label>Liquidity<select value={filters.hasLiquidity===undefined?'':String(filters.hasLiquidity)} onChange={event=>setFilters(current=>({...current,hasLiquidity:event.target.value===''?undefined:event.target.value==='true'}))}><option value="">Any</option><option value="true">LP created</option><option value="false">No LP</option></select></label><button onClick={()=>setFilters(emptyFilters)}>Clear</button></div>
          {error&&<div className="api-error">{error}</div>}<TokenTable tokens={tokens} onSelect={setSelected}/></section></section>
      <footer><p>Heuristic research tool — not financial advice and not a guarantee of contract safety.</p><p>Croikey gated · Ethereum ownership check · Robinhood Chain 4663</p></footer></div>
    <TokenDrawer token={selected} onClose={()=>setSelected(null)}/>
  </main>;
}
