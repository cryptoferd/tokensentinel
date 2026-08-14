import type { Warning } from '@sentinel/shared';

const rules: Array<{ code: string; title: string; severity: Warning['severity']; detail: string; re: RegExp }> = [
  { code:'BLACKLIST', title:'Blacklist capability', severity:'high', detail:'Contract exposes or references blacklist/blocklist logic that may restrict selected wallets.', re:/blacklist|blocklist|isblacklisted|bots\s*\[/i },
  { code:'PAUSABLE', title:'Transfers/trading may be pausable', severity:'medium', detail:'Pause/unpause or trading-enable controls were detected.', re:/\bpause\b|\bunpause\b|tradingenabled|enabletrading|opentrading/i },
  { code:'MINTABLE', title:'Mint capability', severity:'high', detail:'Mint functionality was detected; privileged supply expansion may be possible.', re:/function\s+mint\b|_mint\s*\(/i },
  { code:'TAX_CHANGE', title:'Mutable tax/fee controls', severity:'high', detail:'Owner/admin-style functions appear able to alter taxes or fees.', re:/set.{0,15}(tax|fee)|update.{0,15}(tax|fee)|change.{0,15}(tax|fee)|sellfee|buyfee|selltax|buytax/i },
  { code:'MAX_TX', title:'Mutable transaction limits', severity:'medium', detail:'Maximum transaction controls were detected.', re:/maxtx|maxtransaction|setmaxtx/i },
  { code:'MAX_WALLET', title:'Mutable wallet limits', severity:'medium', detail:'Maximum wallet/holding controls were detected.', re:/maxwallet|maxholding|setmaxwallet/i },
  { code:'WHITELIST', title:'Whitelist/exemption controls', severity:'medium', detail:'Wallet exemptions or whitelist logic may let selected addresses bypass restrictions.', re:/whitelist|isexempt|excludefromfee|feeexempt|exclude.*limit/i },
  { code:'COOLDOWN', title:'Cooldown/transfer-delay logic', severity:'medium', detail:'Cooldown, transfer delay, or per-block transfer restrictions were detected.', re:/cooldown|transferdelay|lasttransfer|oneperblock/i },
  { code:'MANUAL_BALANCE', title:'Manual balance manipulation pattern', severity:'critical', detail:'Source contains suspicious balance mutation/admin patterns worth manual review.', re:/setbalance|manualswap|manualsend|airdrop.*balance/i },
  { code:'UPGRADE', title:'Upgradeable/proxy logic', severity:'high', detail:'Upgradeability patterns were detected; implementation behavior may change later.', re:/upgradeTo|upgradeToAndCall|implementation\(\)|ERC1967|UUPS|transparentUpgradeableProxy/i },
  { code:'ASSEMBLY', title:'Inline assembly', severity:'low', detail:'Inline assembly was detected. It is not inherently malicious but makes review harder.', re:/\bassembly\s*\{/i },
  { code:'DELEGATECALL_SOURCE', title:'Delegatecall in source', severity:'high', detail:'Source references delegatecall, which can execute logic from another contract.', re:/delegatecall/i }
];

export function analyzeSource(source: string | null, abi: unknown[] | null): Warning[] {
  const text = `${source ?? ''}\n${JSON.stringify(abi ?? [])}`;
  return rules.filter(r => r.re.test(text)).map(({ re:_, ...w }) => w);
}
