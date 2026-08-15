import pLimit from 'p-limit';
import { config } from '../config.js';
import { analyzeToken } from '../analysis/analyzer.js';
import { publish } from '../events.js';

const limit = pLimit(config.ANALYSIS_CONCURRENCY);
const queued = new Set<string>();
let active = 0;

export function queueDepth() { return queued.size + active; }
export function enqueueAnalysis(chainKey:string,address: string) {
  address = address.toLowerCase();
  const key=`${chainKey}:${address}`;
  if (queued.has(key)) return;
  queued.add(key);
  publish('queue', { depth: queueDepth() });
  void limit(async () => {
    queued.delete(key); active++;
    try { await analyzeToken(chainKey,address); }
    finally { active--; publish('queue', { depth: queueDepth() }); }
  });
}
