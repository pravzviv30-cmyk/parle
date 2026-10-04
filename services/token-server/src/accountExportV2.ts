import { createHash } from 'node:crypto';
import { authenticationIsRecent } from '@luvani/core';
import { boundedFetchJson } from '../../shared/boundedFetch.ts';
import { signedInRecently } from './accountDeletion.ts';

const uuid=/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const hash=/^[a-f0-9]{64}$/;
export function accountExports(base:string,key:string,request:typeof fetch=fetch) {
  async function rpc(name:'prepare_account_export_v2'|'account_export_part_v2'|'purge_account_export_v2',body:Record<string,unknown>,signal?:AbortSignal) {
    const response=await boundedFetchJson(request,`${base.replace(/\/+$/,'')}/rest/v1/rpc/${name}`,{
      method:'POST',headers:{apikey:key,authorization:`Bearer ${key}`,'content-type':'application/json'},body:JSON.stringify(body),
    },{timeoutMs:name==='prepare_account_export_v2'?30_000:5000,maxBytes:100*1024,...(signal?{signal}:{})});
    if(response.status<200 || response.status>=300 || !response.value || typeof response.value!=='object' || Array.isArray(response.value))throw new Error('account-export-unavailable');
    return response.value as Record<string,unknown>;
  }
  return {
    async prepare(userId:string,authSessionId:string,exportId:string,authenticatedAt:number|undefined,signal?:AbortSignal) {
      if (![userId,authSessionId,exportId].every(id=>uuid.test(id)))throw new Error('invalid-export-identity');
      if (!authenticationIsRecent(authenticatedAt) || !await signedInRecently(base,key,userId,request))return null;
      const value=await rpc('prepare_account_export_v2',{p_user_id:userId,p_auth_session_id:authSessionId,p_export_id:exportId},signal);
      if(value.kind==='refused' && ['inactive-identity','export-disabled','export-unavailable','export-active','export-capacity','export-too-large'].includes(String(value.reason)))return value;
      if(value.kind!=='ready' || value.version!==2 || value.exportId!==exportId || value.format!=='luvani-account-export-ndjson-v2'
        || value.hashAlgorithm!=='sha256-chain-v1' || typeof value.rootSha256!=='string' || !hash.test(value.rootSha256)
        || !Number.isInteger(value.totalBytes) || Number(value.totalBytes)<1 || Number(value.totalBytes)>128*1024*1024
        || !Number.isInteger(value.totalParts) || value.totalParts!==Math.ceil(Number(value.totalBytes)/65536)
        || typeof value.snapshotAt!=='string' || typeof value.expiresAt!=='string' || !Number.isFinite(Date.parse(value.snapshotAt))
        || !Number.isFinite(Date.parse(value.expiresAt)) || Date.parse(value.expiresAt)<=Date.parse(value.snapshotAt))throw new Error('invalid-export-manifest');
      return value;
    },
    async part(userId:string,authSessionId:string,exportId:string,part:number,signal?:AbortSignal) {
      if(![userId,authSessionId,exportId].every(id=>uuid.test(id)) || !Number.isInteger(part) || part<0 || part>2047)throw new Error('invalid-export-part');
      const value=await rpc('account_export_part_v2',{p_user_id:userId,p_auth_session_id:authSessionId,p_export_id:exportId,p_part:part},signal);
      if(value.kind==='unavailable')return null;
      if(value.kind!=='part' || value.version!==2 || value.exportId!==exportId || value.part!==part || !Number.isInteger(value.totalParts)
        || Number(value.totalParts)<1 || Number(value.totalParts)>2048 || part>=Number(value.totalParts)
        || !Number.isInteger(value.bytes) || Number(value.bytes)<1 || Number(value.bytes)>65536
        || value.nextPart!==(part+1<Number(value.totalParts)?part+1:null) || typeof value.sha256!=='string' || !hash.test(value.sha256)
        || typeof value.dataBase64!=='string' || !/^(?:[A-Za-z0-9+/]{4})*(?:[A-Za-z0-9+/]{2}==|[A-Za-z0-9+/]{3}=)?$/.test(value.dataBase64))throw new Error('invalid-export-part');
      const data=Buffer.from(value.dataBase64,'base64');
      if(data.byteLength!==value.bytes || data.toString('base64')!==value.dataBase64 || createHash('sha256').update(data).digest('hex')!==value.sha256)throw new Error('invalid-export-part');
      return value;
    },
    async purge(userId:string,exportId:string,signal?:AbortSignal) {
      if(![userId,exportId].every(id=>uuid.test(id)))throw new Error('invalid-export-identity');
      if((await rpc('purge_account_export_v2',{p_user_id:userId,p_export_id:exportId},signal)).kind!=='purged')throw new Error('account-export-unavailable');
    },
  };
}
