import type { ScanSession, Stats, TokenFilters, TokenRecord } from '@sentinel/shared';
export const API=(import.meta.env.VITE_API_URL||'http://localhost:8787').replace(/\/$/,'');
const SESSION_KEY='sentinel_wallet_session';
export const getSessionToken=()=>localStorage.getItem(SESSION_KEY);
export const saveSessionToken=(token:string)=>localStorage.setItem(SESSION_KEY,token);
export const clearSessionToken=()=>localStorage.removeItem(SESSION_KEY);

async function request<T>(path:string,init:RequestInit={}) {
  const token=getSessionToken(); const headers=new Headers(init.headers);
  if (token) headers.set('Authorization',`Bearer ${token}`);
  if (init.body&&!headers.has('Content-Type')) headers.set('Content-Type','application/json');
  const response=await fetch(`${API}${path}`,{...init,headers});
  const body=await response.json().catch(()=>({}));
  if(!response.ok) { if(response.status===401) clearSessionToken(); throw new Error(body.error||`Request failed (${response.status})`); }
  return body as T;
}
export const authConfig=()=>request<{chainId:number;chainName:string;contract:string;collection:string}>('/api/auth/config');
export const authNonce=(address:string)=>request<{message:string}>('/api/auth/nonce',{method:'POST',body:JSON.stringify({address})});
export const authVerify=(address:string,signature:string)=>request<{token:string;address:string;balance:string;expiresAt:number}>('/api/auth/verify',{method:'POST',body:JSON.stringify({address,signature})});
export const authMe=()=>request<{address:string;collection:string;contract:string}>('/api/auth/me');
export const logout=()=>request('/api/auth/logout',{method:'POST'}).finally(clearSessionToken);
export const fetchStats=()=>request<Stats>('/api/stats');
export const fetchToken=(address:string)=>request<TokenRecord>(`/api/tokens/${address}`);
export const rescan=(address:string)=>request(`/api/tokens/${address}/rescan`,{method:'POST'});
export const startScanner=(durationMinutes:number)=>request<{scan:ScanSession}>('/api/scanner/start',{method:'POST',body:JSON.stringify({durationMinutes})});
export const stopScanner=(scanId?:string)=>request('/api/scanner/stop',{method:'POST',body:JSON.stringify({scanId})});
export const startHistoryScan=(lookbackMinutes:number)=>request<{scan:ScanSession}>('/api/scans/history',{method:'POST',body:JSON.stringify({lookbackMinutes})});
export const fetchScans=()=>request<{items:ScanSession[]}>('/api/scans').then(value=>value.items);
export const deleteScan=(scanId:string)=>request<{deleted:boolean;id:string}>(`/api/scans/${scanId}`,{method:'DELETE'});
export async function fetchScanResults(scanId:string,filters:TokenFilters={}) {
  const params=new URLSearchParams({limit:'200'});
  Object.entries(filters).forEach(([key,value])=>{if(value!==undefined&&value!==''&&value!==null)params.set(key,String(value));});
  return request<{scan:ScanSession;items:TokenRecord[]}>(`/api/scans/${scanId}/results?${params}`);
}
