import express from 'express';
import cors from 'cors';
import { config } from '../config.js';
import { events } from '../events.js';
import { getToken, listTokens, stats } from '../db/repository.js';
import { client } from '../chain/client.js';
import { enqueueAnalysis, queueDepth } from '../workers/analysisQueue.js';
import { runScanner, scannerStatus, stopScanner } from '../workers/blockScanner.js';

export function createServer() {
  const app = express();
  app.use(express.json());
  app.use(cors({ origin(origin, cb) {
    if (!origin || isOriginAllowed(origin)) cb(null, true);
    else cb(new Error('CORS blocked'));
  } }));

  app.get('/health', (_req,res) => res.json({ ok:true, chainId:config.CHAIN_ID, rpc:config.RPC_URL.replace(/\/v2\/[^/]+$/, '/v2/***') }));
  app.get('/api/tokens', (req,res) => {
    const limit = Math.min(200, Math.max(1, Number(req.query.limit ?? 50)));
    const offset = Math.max(0, Number(req.query.offset ?? 0));
    res.json({ items:listTokens({ limit, offset, risk:typeof req.query.risk === 'string' ? req.query.risk : undefined, q:typeof req.query.q === 'string' ? req.query.q : undefined }) });
  });
  app.get('/api/tokens/:address', (req,res) => {
    const token = getToken(req.params.address); if (!token) return res.status(404).json({ error:'Token not found' }); res.json(token);
  });
  app.post('/api/tokens/:address/rescan', (req,res) => {
    const token = getToken(req.params.address); if (!token) return res.status(404).json({ error:'Token not found' }); enqueueAnalysis(token.address); res.status(202).json({ queued:true });
  });
  app.post('/api/scanner/start', (req,res) => {
    const durationMinutes = Number(req.body?.durationMinutes);
    if (!Number.isInteger(durationMinutes) || durationMinutes < 5 || durationMinutes > 60) {
      return res.status(400).json({ error:'durationMinutes must be a whole number from 5 to 60' });
    }
    if (scannerStatus().running) return res.status(409).json({ error:'Scanner is already running', ...scannerStatus() });
    void runScanner({ durationMinutes, fromLatest:true }).catch(error => console.error('[scanner] session failed:', error));
    res.status(202).json({ started:true, ...scannerStatus() });
  });
  app.post('/api/scanner/stop', (_req,res) => {
    const stopping = stopScanner();
    res.status(stopping ? 202 : 200).json({ stopping, ...scannerStatus() });
  });
  app.get('/api/stats', async (_req,res) => {
    const s = stats(); const scanner = scannerStatus();
    let latestBlock = scanner.latestKnown; try { latestBlock = Number(await client.getBlockNumber()); } catch {}
    res.json({ ...s, latestBlock, scannedBlock:scanner.scanned, scannerRunning:scanner.running, scannerStartedAt:scanner.startedAt, scannerEndsAt:scanner.endsAt, queueDepth:queueDepth() });
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

function isOriginAllowed(origin: string) {
  const candidate = origin.toLowerCase();
  return config.corsOrigins.some(pattern => {
    if (pattern === '*' || pattern === candidate) return true;
    if (!pattern.includes('*')) return false;

    const escaped = pattern.replace(/[.+?^${}()|[\]\\]/g, '\\$&').replace(/\*/g, '.*');
    return new RegExp(`^${escaped}$`).test(candidate);
  });
}
