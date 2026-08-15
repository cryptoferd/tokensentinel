import express from 'express';
import cors from 'cors';
import { randomUUID } from 'node:crypto';
import { config } from '../config.js';
import { events } from '../events.js';
import { activeLiveScanForUser, createScanSession, deleteScanSession, getScanSession, getToken, listScanSessions, listScanTokens, listTokens, latestActiveLiveEnd, stats, stopLiveScan } from '../db/repository.js';
import { chainOptions, getChain, getClient } from '../chain/chains.js';
import { enqueueAnalysis, queueDepth } from '../workers/analysisQueue.js';
import { runScanner, scannerStatus, stopScanner } from '../workers/blockScanner.js';
import { createChallenge, gateInfo, logout, requireAuth, verifyGateAndCreateSession } from '../auth.js';
import { runHistoricalScan } from '../workers/historicalScanner.js';
import type { ScanAssetType, TokenFilters } from '@sentinel/shared';
import { enqueueMarketRefresh } from '../workers/marketRefresh.js';

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin(origin, cb) {
    if (!origin || isOriginAllowed(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  } }));
  app.use('/api',(_req,res,next)=>{res.setHeader('Cache-Control','no-store, no-cache, must-revalidate, proxy-revalidate');res.setHeader('Pragma','no-cache');res.setHeader('Expires','0');next();});

  app.get('/health', (_req,res) => res.json({ ok:true, chains:chainOptions().filter(chain=>chain.enabled).map(chain=>chain.key),alchemyConfigured:Boolean(config.ALCHEMY_API_KEY) }));
  app.get('/api/auth/config',(_req,res)=>res.json(gateInfo));
  app.post('/api/auth/nonce',(req,res)=>{
    try { res.json(createChallenge(String(req.body?.address??''))); }
    catch { res.status(400).json({error:'Enter a valid EVM wallet address.'}); }
  });
  app.post('/api/auth/verify',async(req,res)=>{
    try { res.json(await verifyGateAndCreateSession(String(req.body?.address??''),String(req.body?.signature??'') as `0x${string}`)); }
    catch(error){ res.status(403).json({error:error instanceof Error?error.message:'Wallet verification failed'}); }
  });
  app.use('/api',requireAuth);
  app.get('/api/chains',(_req,res)=>res.json({items:chainOptions()}));
  app.get('/api/auth/me',(req,res)=>res.json({address:req.userAddress,...gateInfo}));
  app.post('/api/auth/logout',(req,res)=>{logout(req);res.json({ok:true});});
  app.get('/api/tokens', (req,res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    res.json({ items:listTokens({ limit, offset, chainKey:typeof req.query.chainKey==='string'?req.query.chainKey:undefined,risk:typeof req.query.risk === 'string' ? req.query.risk : undefined, q:typeof req.query.q === 'string' ? req.query.q : undefined }) });
  });
  app.get('/api/tokens/:address', (req,res) => {
    const chainKey=String(req.query.chainKey??'robinhood');const token = getToken(chainKey,req.params.address); if (!token) return res.status(404).json({ error:'Token not found' }); enqueueMarketRefresh(token);res.json(token);
  });
  app.post('/api/tokens/:address/rescan', (req,res) => {
    const chainKey=String(req.query.chainKey??req.body?.chainKey??'robinhood');const token = getToken(chainKey,req.params.address); if (!token) return res.status(404).json({ error:'Token not found' }); enqueueAnalysis(chainKey,token.address); res.status(202).json({ queued:true });
  });
  app.post('/api/scanner/start', (req,res) => {
    const durationMinutes = Number(req.body?.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 60) {
      return res.status(400).json({ error:'durationMinutes must be a whole number from 5 to 60' });
    }
    const assetType=parseAssetType(req.body?.assetType);
    if(!assetType)return res.status(400).json({error:'assetType must be ERC20, ERC721 or BOTH'});
    const chain=resolveChain(req.body?.chainKey);if(!chain)return res.status(400).json({error:'Choose a supported, enabled chain.'});
    const status=scannerStatus();if(status.running&&status.chainKey!==chain.key)return res.status(409).json({error:`The live scanner is currently monitoring ${getChain(status.chainKey!).name}. Stop it before switching chains.`});
    const existing=activeLiveScanForUser(req.userAddress!);
    if (existing) return res.status(409).json({error:'You already have a live scan running.',scan:existing});
    const endsAt=Date.now()+durationMinutes*60_000;
    const scan=createScanSession({id:randomUUID(),userAddress:req.userAddress!,mode:'live',assetType,chain,durationMinutes,endsAt});
    void runScanner({ chainKey:chain.key,durationMinutes, fromLatest:true }).catch(error => console.error('[scanner] session failed:', error));
    res.status(202).json({ started:true, scan, ...scannerStatus() });
  });
  app.post('/api/scanner/stop', (req,res) => {
    const scanId=String(req.body?.scanId??activeLiveScanForUser(req.userAddress!)?.id??'');
    const stopping=stopLiveScan(scanId,req.userAddress!);
    if (!latestActiveLiveEnd()) stopScanner();
    res.status(stopping ? 202 : 200).json({ stopping, scanId, ...scannerStatus() });
  });
  app.get('/api/stats', async (req,res) => {
    const s = stats();const requestedChain=String(req.query.chainKey??'robinhood'); const scanner = scannerStatus(requestedChain);
    let latestBlock = scanner.chainKey===requestedChain?scanner.latestKnown:0; try { latestBlock = Number(await getClient(requestedChain).getBlockNumber()); } catch {}
    const activeScan=activeLiveScanForUser(req.userAddress!);
    res.json({ ...s, latestBlock, scannedBlock:scanner.scanned, scannerRunning:Boolean(activeScan), scannerStartedAt:activeScan?.startedAt??null, scannerEndsAt:activeScan?.endsAt??null, queueDepth:queueDepth(),activeScan });
  });
  app.post('/api/scans/history',(req,res)=>{
    const lookbackMinutes=Number(req.body?.lookbackMinutes);
    if (![5,30,60,180,360,720,1440].includes(lookbackMinutes)) return res.status(400).json({error:'Choose 5m, 30m, 1h, 3h, 6h, 12h or 24h.'});
    const assetType=parseAssetType(req.body?.assetType);
    if(!assetType)return res.status(400).json({error:'assetType must be ERC20, ERC721 or BOTH'});
    const chain=resolveChain(req.body?.chainKey);if(!chain)return res.status(400).json({error:'Choose a supported, enabled chain.'});
    const scan=createScanSession({id:randomUUID(),userAddress:req.userAddress!,mode:'history',assetType,chain,lookbackMinutes});
    void runHistoricalScan(scan.id,chain.key,lookbackMinutes);
    res.status(202).json({scan});
  });
  app.get('/api/scans',(req,res)=>res.json({items:listScanSessions(req.userAddress!)}));
  app.get('/api/scans/:id',(req,res)=>{
    const scan=getScanSession(req.params.id,req.userAddress!); if(!scan)return res.status(404).json({error:'Scan not found'}); res.json(scan);
  });
  app.delete('/api/scans/:id',(req,res)=>{
    const result=deleteScanSession(req.params.id,req.userAddress!);
    if(result.reason==='not_found')return res.status(404).json({error:'Scan not found'});
    if(result.reason==='running')return res.status(409).json({error:'Stop this scan before deleting it.'});
    res.json({deleted:true,id:req.params.id});
  });
  app.get('/api/scans/:id/results',(req,res)=>{
    const scan=getScanSession(req.params.id,req.userAddress!); if(!scan)return res.status(404).json({error:'Scan not found'});
    const number=(name:string)=>typeof req.query[name]==='string'&&req.query[name]!==''?Number(req.query[name]):undefined;
    const filters:TokenFilters={q:typeof req.query.q==='string'?req.query.q:undefined,risk:typeof req.query.risk==='string'?req.query.risk:undefined,
      assetType:req.query.assetType==='ERC20'||req.query.assetType==='ERC721'?req.query.assetType:undefined,
      minMarketCap:number('minMarketCap'),maxMarketCap:number('maxMarketCap'),minHolders:number('minHolders'),maxHolders:number('maxHolders'),maxTop5:number('maxTop5'),maxBuyTax:number('maxBuyTax'),maxSellTax:number('maxSellTax'),
      hasLiquidity:req.query.hasLiquidity==='true'?true:req.query.hasLiquidity==='false'?false:undefined};
    const limit=Math.min(200,Math.max(1,Number(req.query.limit??100))),offset=Math.max(0,Number(req.query.offset??0));
    const items=listScanTokens(scan.id,req.userAddress!,filters,limit,offset);items.forEach(enqueueMarketRefresh);
    res.json({scan,items});
  });
  app.get('/api/stream', (req,res) => {
    res.setHeader('Content-Type','text/event-stream'); res.setHeader('Cache-Control','no-cache'); res.setHeader('Connection','keep-alive'); res.flushHeaders();
    res.write(`event: hello\ndata: ${JSON.stringify({ at:Date.now() })}\n\n`);
    const handler = (message:unknown) => res.write(`data: ${JSON.stringify(message)}\n\n`);
    const keep = setInterval(() => res.write(': ping\n\n'), 20_000);
    events.on('message', handler);
    req.on('close', () => { clearInterval(keep); events.off('message', handler); });
  });
  return app;
}

function parseAssetType(value:unknown):ScanAssetType|null {
  const normalized=String(value??'ERC20').toUpperCase();
  return normalized==='ERC20'||normalized==='ERC721'||normalized==='BOTH'?normalized:null;
}

function resolveChain(value:unknown) {
  const key=String(value??'robinhood');
  return chainOptions().find(chain=>chain.key===key&&chain.enabled)??null;
}

function isOriginAllowed(origin: string) {
  const candidate = origin.toLowerCase();
  return config.corsOrigins.some(pattern => {
    if (pattern === '*' || pattern === candidate) return true;
    if (!pattern.includes('*')) return false;

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(candidate);
  });
}
