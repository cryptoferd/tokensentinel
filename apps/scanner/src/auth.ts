import { createHash, randomBytes } from 'node:crypto';
import type { NextFunction, Request, Response } from 'express';
import { createPublicClient, getAddress, http, parseAbi, verifyMessage } from 'viem';
import { mainnet } from 'viem/chains';
import { config } from './config.js';
import { consumeChallenge, createAuthSession, deleteAuthSession, getAuthSession, saveChallenge } from './db/repository.js';

const gateAbi = parseAbi(['function balanceOf(address owner) view returns (uint256)']);
const gateClient = createPublicClient({ chain:mainnet, transport:http(config.GATE_RPC_URL,{timeout:20_000,retryCount:2}) });
const hash = (value:string) => createHash('sha256').update(value).digest('hex');

declare global {
  namespace Express { interface Request { userAddress?: string; sessionHash?: string } }
}

export function createChallenge(addressRaw:string) {
  const address=getAddress(addressRaw);
  const nonce=randomBytes(18).toString('hex');
  const issuedAt=new Date().toISOString();
  const message=`Robinhood Token Sentinel\n\nSign in with wallet: ${address}\nThis request will not trigger a blockchain transaction.\n\nNonce: ${nonce}\nIssued at: ${issuedAt}`;
  saveChallenge(address,message,Date.now()+config.AUTH_CHALLENGE_TTL_MINUTES*60_000);
  return { address, message, expiresInMinutes:config.AUTH_CHALLENGE_TTL_MINUTES };
}

export async function verifyGateAndCreateSession(addressRaw:string, signature:`0x${string}`) {
  const address=getAddress(addressRaw);
  const challenge=consumeChallenge(address);
  if (!challenge || challenge.expires_at<Date.now()) throw new Error('Login challenge expired. Please try again.');
  const valid=await verifyMessage({address,message:challenge.message,signature});
  if (!valid) throw new Error('Wallet signature could not be verified.');
  const balance=await gateClient.readContract({address:getAddress(config.GATE_CONTRACT_ADDRESS),abi:gateAbi,functionName:'balanceOf',args:[address]});
  if (balance<=0n) throw new Error('This wallet does not hold a Croikey and cannot access Token Sentinel.');
  const token=randomBytes(32).toString('base64url');
  const expiresAt=Date.now()+config.SESSION_TTL_HOURS*60*60_000;
  createAuthSession(hash(token),address,expiresAt);
  return { token,address,balance:balance.toString(),expiresAt };
}

export function requireAuth(req:Request,res:Response,next:NextFunction) {
  const value=req.header('authorization');
  if (!value?.startsWith('Bearer ')) return res.status(401).json({error:'Wallet login required'});
  const token=value.slice(7).trim(); const tokenHash=hash(token); const session=getAuthSession(tokenHash);
  if (!session) return res.status(401).json({error:'Session expired. Connect your wallet again.'});
  req.userAddress=session.address; req.sessionHash=tokenHash; next();
}

export function logout(req:Request) { if (req.sessionHash) deleteAuthSession(req.sessionHash); }

export const gateInfo={ chainId:config.GATE_CHAIN_ID, chainName:'Ethereum', contract:config.GATE_CONTRACT_ADDRESS, collection:'Croikeys' };
