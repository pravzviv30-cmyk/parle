import {boundedFetchJson} from './boundedFetch.ts';
import { createHash } from 'node:crypto';
import type { ConversationPack, ServiceFailure } from '@luvani/core';

export const TUTOR_RPC_NAMES = ['reserve_tutor_session_v1', 'claim_tutor_session_v1', 'checkpoint_tutor_session_v1', 'complete_tutor_session_v1', 'abandon_tutor_session_v1', 'reconcile_tutor_sessions_v1', 'receipt_tutor_session_v1', 'fence_tutor_account_v1', 'tutor_session_schema_v1', 'configure_privacy_processor_v1', 'begin_account_erasure_v1', 'claim_account_erasure_v1', 'advance_account_erasure_v1', 'run_data_retention_v1', 'publish_backend_heartbeat_v1', 'backend_status_v1', 'backend_catalog_v1', 'cleanup_account_exports_v2', 'expire_session_details_v2', 'reconcile_practice_jobs_v1'] as const;
export type TutorRpcName = typeof TUTOR_RPC_NAMES[number];
export interface TutorSessionReport {
  seconds: number;
  learnerTurns: number;
  serviceFailure?: ServiceFailure;
  baseline?: ConversationPack;
}
export class TutorRpcError extends Error {
  readonly status: number;
  constructor(status: number) { super('tutor-session-operation-unavailable'); this.name = 'TutorRpcError'; this.status = status; }
}

/** The transmitted report is immutable across response loss and retries. */
export function canonicalJson(value: unknown): string {
  if (value === null || typeof value === 'string' || typeof value === 'boolean') return JSON.stringify(value);
  if (typeof value === 'number' && Number.isFinite(value)) return JSON.stringify(value);
  if (typeof value !== 'object') throw new Error('non-json-session-payload');
  if (Array.isArray(value)) return `[${value.map(canonicalJson).join(',')}]`;
  const row = value as Record<string, unknown>;
  return `{${Object.keys(row).filter(key => row[key] !== undefined).sort().map(key => `${JSON.stringify(key)}:${canonicalJson(row[key])}`).join(',')}}`;
}
export const tutorDigest = (value: unknown): string => createHash('sha256').update(canonicalJson(value)).digest('hex');

/** Only fixed service RPC names and bounded response bytes cross this adapter. */
export function tutorSessionRpc(baseUrl: string, serviceKey: string, request: typeof fetch = fetch) {
  return async (name: TutorRpcName, args: Record<string, unknown>, signal?: AbortSignal): Promise<Record<string, unknown>> => {
    try {
      const response=await boundedFetchJson(request,`${baseUrl.replace(/\/+$/,'')}/rest/v1/rpc/${name}`,{
        method:'POST',headers:{apikey:serviceKey,authorization:`Bearer ${serviceKey}`,'content-type':'application/json'},body:JSON.stringify(args),
      },{timeoutMs:5000,maxBytes:160*1024,...(signal?{signal}:{})});
      if(response.status<200 || response.status>=300)throw new TutorRpcError(response.status);
      const value=response.value;
      if(!value || typeof value!=='object' || Array.isArray(value))throw new TutorRpcError(503);
      return value as Record<string,unknown>;
    } catch(error) {throw error instanceof TutorRpcError?error:new TutorRpcError(503);}

  };
}
