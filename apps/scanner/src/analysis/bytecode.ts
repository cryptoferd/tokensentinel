const flagOps = new Map<number, string>([
  [0xf4, 'DELEGATECALL'], [0xff, 'SELFDESTRUCT'], [0xf2, 'CALLCODE'], [0xf5, 'CREATE2']
]);

export function scanOpcodes(bytecode: `0x${string}` | undefined): string[] {
  if (!bytecode || bytecode === '0x') return [];
  const hex = bytecode.slice(2);
  const bytes = Buffer.from(hex.length % 2 ? `0${hex}` : hex, 'hex');
  const found = new Set<string>();
  for (let i = 0; i < bytes.length; i++) {
    const op = bytes[i]!;
    const name = flagOps.get(op);
    if (name) found.add(name);
    if (op >= 0x60 && op <= 0x7f) i += op - 0x5f;
  }
  return [...found];
}

export function looksLikeMinimalProxy(bytecode: `0x${string}` | undefined) {
  if (!bytecode) return false;
  const h = bytecode.toLowerCase();
  return h.includes('363d3d373d3d3d363d73') && h.includes('5af43d82803e903d91602b57fd5bf3');
}
