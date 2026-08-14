import { useEffect } from 'react';
import { API } from '../lib/api';
export function useLive(onMessage:()=>void) {
  useEffect(()=>{ const es=new EventSource(`${API}/api/stream`); let timer:number|undefined; es.onmessage=()=>{ window.clearTimeout(timer); timer=window.setTimeout(onMessage,180); }; return()=>{window.clearTimeout(timer);es.close();}; },[onMessage]);
}
