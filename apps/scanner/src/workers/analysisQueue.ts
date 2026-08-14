import pLimit from 'p-limit';
import { config } from '../config.js';
import { analyzeToken } from '../analysis/analyzer.js';
import { publish } from '../events.js';

const limit = pLimit(config.ANALYSIS_CONCURRENCY);
const queued = new Set<string>();
let active = 0;

export function queueDepth() { return queued.size + active; }
export function enqueueAnalysis(address: string) {
  address = address.toLowerCase();
  if (queued.has(address)) return;
  queued.add(address);
  publish('queue', { depth: queueDepth() });
  void limit(async () => {
    queued.delete(address); active++;
    try { await analyzeToken(address); }
    finally { active--; publish('queue', { depth: queueDepth() }); }
  });
}
