import { parseAbi, parseAbiItem } from 'viem';

export const erc20Abi = parseAbi([
  'function name() view returns (string)',
  'function symbol() view returns (string)',
  'function decimals() view returns (uint8)',
  'function totalSupply() view returns (uint256)',
  'function balanceOf(address) view returns (uint256)',
  'function owner() view returns (address)'
]);

export const erc165Abi = parseAbi([
  'function supportsInterface(bytes4 interfaceId) view returns (bool)'
]);

export const transferEvent = parseAbiItem('event Transfer(address indexed from, address indexed to, uint256 value)');
export const pairCreatedEvent = parseAbiItem('event PairCreated(address indexed token0, address indexed token1, address pair, uint256)');
export const poolCreatedEvent = parseAbiItem('event PoolCreated(address indexed token0, address indexed token1, uint24 indexed fee, int24 tickSpacing, address pool)');

export const poolViewAbi = parseAbi([
  'function token0() view returns (address)',
  'function token1() view returns (address)'
]);
