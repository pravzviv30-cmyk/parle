/** Owner-bound streaming export. No partial or unchecked archive reaches sharing. */
import AsyncStorage from '@react-native-async-storage/async-storage';
import type { AuthAdapter,AuthUser } from '../auth/types.ts';
import { TOKEN_SERVER } from '../live/serverUrl.ts';
import { activeUserId,scopeGeneration,onUserScopeReset,USER_KEY_SUFFIXES } from '../storage/scope.ts';
import { createExportFile,type ExportFile } from './exportFile.ts';
import type { AccountExportResult,ExportDependencies } from './export.ts';
export interface PagedExportDependencies extends ExportDependencies {
  createFile?:(bytes:number)=>Promise<ExportFile>;
  sha256?:(bytes:Uint8Array)=>Promise<Uint8Array>;
  exportId?:()=>string;
  pause?:(milliseconds:number,signal:AbortSignal)=>Promise<void>;
}
const hash=/^[a-f0-9]{64}$/;
const hex=(bytes:Uint8Array)=>Array.from(bytes,b=>b.toString(16).padStart(2,'0')).join('');
const unhex=(text:string)=>Uint8Array.from(text.match(/../g)??[],byte=>parseInt(byte,16));
const join=(a:Uint8Array,b:Uint8Array)=>{const bytes=new Uint8Array(a.length+b.length);bytes.set(a);bytes.set(b,a.length);return bytes;};
export async function downloadPagedAccountData(user:AuthUser,adapter:AuthAdapter,deps:PagedExportDependencies={}):Promise<AccountExportResult> {
  const owner=scopeGeneration();const controller=new AbortController();const unregister=onUserScopeReset(()=>controller.abort());
  const current=async()=>!controller.signal.aborted && activeUserId()===user.id && owner===scopeGeneration() && (await adapter.getSession())?.id===user.id;
  let file:ExportFile|undefined;let exportId:string|undefined;let token:string|null=null;let request:typeof fetch|undefined=deps.request;
  let success=false;let cleanupFailed=false;
  const sha=deps.sha256??(async(bytes:Uint8Array)=>{const crypto=await import('expo-crypto');return new Uint8Array(await crypto.digest(crypto.CryptoDigestAlgorithm.SHA256,new Uint8Array(bytes)));});
  async function json(path:string,method='GET',body?:unknown,timeoutMs=8000,signal=controller.signal,refresh=true):Promise<{status:number;value:Record<string,unknown>;retryAfter:number}> {
    if(refresh){if(!await current())throw new Error('account-changed');token=await adapter.getAccessToken();if(!token || !await current())throw new Error('account-changed');}
    const deadline=new AbortController();const stop=AbortSignal.any([deadline.signal,signal]);let timer:ReturnType<typeof setTimeout>|undefined;let rejectStop=(_error:unknown)=>{};
    const interrupted=new Promise<never>((_resolve,reject)=>{rejectStop=reject;});const abort=()=>rejectStop(new Error('export-interrupted'));stop.addEventListener('abort',abort,{once:true});
    try {
      if(stop.aborted)throw new Error('export-interrupted');timer=setTimeout(()=>deadline.abort(),timeoutMs);
      return await Promise.race([(async()=>{
        const response=await request!(`${TOKEN_SERVER}${path}`,{method,headers:{authorization:`Bearer ${token}`,...(body?{'content-type':'application/json'}:{})},...(body?{body:JSON.stringify(body)}:{}),signal:stop,redirect:'error'});
        let text='';const reader=response.body?.getReader();
        if(reader){const parts:Uint8Array[]=[];let bytes=0;try{while(true){const part=await reader.read();if(part.done)break;bytes+=part.value.byteLength;if(bytes>100*1024 || stop.aborted)throw new Error('export-response-limit');parts.push(part.value);}const all=new Uint8Array(bytes);let offset=0;for(const part of parts){all.set(part,offset);offset+=part.length;}text=new TextDecoder().decode(all);}finally{void reader.cancel().catch(()=>{});}}
        else {text=await response.text();if(new TextEncoder().encode(text).byteLength>100*1024)throw new Error('export-response-limit');}
        const value=text?JSON.parse(text):{};if(!value || typeof value!=='object' || Array.isArray(value))throw new Error('invalid-export-response');
        const retry=Number(response.headers.get('retry-after')??1);
        return {status:response.status,value,retryAfter:Number.isFinite(retry)&&retry>=1&&retry<=60?retry:1};
      })(),interrupted]);
    }finally{if(timer)clearTimeout(timer);stop.removeEventListener('abort',abort);deadline.abort();}
  }
  let message='Your data could not be prepared just now. Nothing was changed.';
  try {
    if(!await current())throw new Error('account-changed');token=await adapter.getAccessToken();if(!token) return {ok:false,message:'Sign in again, then ask for your data.'};
    request??=(await import('expo/fetch')).fetch as typeof fetch;
    exportId=deps.exportId?.()??(await import('expo-crypto')).randomUUID();
    const prepared=await json('/account/export-v2','POST',{exportId},40_000);
    if(prepared.status===401 || prepared.status===403){message='Sign in again to confirm it is you, then download your data.';throw new Error('reauthentication-required');}
    if(prepared.status===429){message='That needs a short pause. Try the export again later.';throw new Error('export-rate-limited');}
    const manifest=prepared.value;
    if(manifest.reason==='export-too-large'){message='This archive needs a larger export. Contact support so your data can be prepared in full.';throw new Error('export-capacity');}
    if(prepared.status!==200 || manifest.kind!=='ready' || manifest.version!==2 || manifest.exportId!==exportId
      || manifest.format!=='luvani-account-export-ndjson-v2' || manifest.hashAlgorithm!=='sha256-chain-v1'
      || typeof manifest.rootSha256!=='string' || !hash.test(manifest.rootSha256) || !Number.isInteger(manifest.totalBytes)
      || Number(manifest.totalBytes)<1 || Number(manifest.totalBytes)>128*1024*1024 || manifest.totalParts!==Math.ceil(Number(manifest.totalBytes)/65536)
      || typeof manifest.expiresAt!=='string' || !Number.isFinite(Date.parse(manifest.expiresAt)) || Date.parse(manifest.expiresAt)<=Date.now())throw new Error('invalid-export-manifest');
    if(!await current())throw new Error('account-changed');
    file=await(deps.createFile??createExportFile)(Number(manifest.totalBytes));
    let chain=await sha(new Uint8Array());let total=0;
    for(let part=0;part<Number(manifest.totalParts);part++) {
      if(!await current())throw new Error('account-changed');
      let page=await json(`/account/export-v2/${exportId}?part=${part}`);
      for(let retry=0;page.status===429 && retry<3;retry++) {
        const pauseMs=page.retryAfter*1000+250;
        if(Date.now()+pauseMs>=Date.parse(manifest.expiresAt))throw new Error('export-expired');
        const pause=deps.pause??((milliseconds:number,signal:AbortSignal)=>new Promise<void>((resolve,reject)=>{
          if(signal.aborted){reject(new Error('export-interrupted'));return;}
          const abort=()=>{clearTimeout(timer);reject(new Error('export-interrupted'));};
          const timer=setTimeout(()=>{signal.removeEventListener('abort',abort);resolve();},milliseconds);
          signal.addEventListener('abort',abort,{once:true});
        }));
        await pause(pauseMs,controller.signal);if(!await current())throw new Error('account-changed');
        page=await json(`/account/export-v2/${exportId}?part=${part}`);
      }
      if(page.status!==200)throw new Error('export-page-unavailable');const value=page.value;
      if(value.kind!=='part' || value.version!==2 || value.exportId!==exportId || value.part!==part || value.totalParts!==manifest.totalParts
        || value.nextPart!==(part+1<Number(manifest.totalParts)?part+1:null) || typeof value.sha256!=='string' || !hash.test(value.sha256)
        || typeof value.dataBase64!=='string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.dataBase64))throw new Error('invalid-export-part');
      const bytes=Uint8Array.from(atob(value.dataBase64),char=>char.charCodeAt(0));
      const expected=Math.min(65536,Number(manifest.totalBytes)-total);
      if(bytes.length!==expected || value.bytes!==expected || hex(await sha(bytes))!==value.sha256)throw new Error('export-integrity');
      chain=await sha(join(chain,unhex(value.sha256)));total+=bytes.length;
      if(!await current())throw new Error('account-changed');await file.append(bytes);
    }
    if(total!==manifest.totalBytes || hex(chain)!==manifest.rootSha256)throw new Error('export-integrity');
    // Device data is separate from the immutable server snapshot and read one
    // scoped key at a time. It is never part of the server hash-chain claim.
    let deviceBytes=0;
    for(const suffix of USER_KEY_SUFFIXES) {
      if(!await current())throw new Error('account-changed');const key=`luvani.u.${user.id}.${suffix}`;
      const pairs=await(deps.readDevice??(keys=>AsyncStorage.multiGet([...keys])))([key]);
      if(pairs.length!==1 || pairs[0]?.[0]!==key)throw new Error('invalid-device-export');const raw=pairs[0][1];
      if(raw!==null && raw.length>512*1024)throw new Error('device-export-limit');
      let value:unknown=raw;try{value=raw===null?null:JSON.parse(raw);}catch{}
      const record=new TextEncoder().encode(JSON.stringify({kind:'device',key:suffix,value})+'\n');deviceBytes+=record.length;
      if(deviceBytes>8*1024*1024)throw new Error('device-export-limit');
      for(let offset=0;offset<record.length;offset+=65536){if(!await current())throw new Error('account-changed');await file.append(record.subarray(offset,offset+65536));}
    }
    if(!await current())throw new Error('account-changed');await file.share();if(!await current())throw new Error('account-changed');success=true;
  } catch(error) {
    if(error instanceof Error && error.message==='large-browser-export-requires-streaming-storage')message='This browser cannot prepare a larger archive. Use the app or a browser with private file storage.';
    if(owner!==scopeGeneration())message='The account changed. Ask for your data again.';
  } finally {
    unregister();controller.abort();
    if(file)try{await file.discard();}catch{cleanupFailed=true;}
    if(exportId && token && request)try{await json(`/account/export-v2/${exportId}`,'DELETE',undefined,5000,new AbortController().signal,false);}catch{/* Server TTL cleanup remains authoritative. */}
  }
  return success&&!cleanupFailed?{ok:true}:{ok:false,message:cleanupFailed?'A temporary export could not be removed. Close the app and try again.':message};
}
