import type { Warning } from '@sentinel/shared';

const weight = { info:0, low:3, medium:9, high:18, critical:30 } as const;
export function scoreRisk(warnings: Warning[]) {
  const unique = new Map(warnings.map(w => [w.code, w]));
  let score = 0;
  for (const w of unique.values()) score += weight[w.severity];
  score = Math.min(100, score);
  const label = score >= 71 ? 'CRITICAL' : score >= 41 ? 'HIGH' : score >= 21 ? 'MODERATE' : 'LOW';
  return { score, label: label as 'LOW'|'MODERATE'|'HIGH'|'CRITICAL', warnings:[...unique.values()] };
}
