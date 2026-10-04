import {randomUUID} from 'node:crypto';
import {paidAdmission,paidAdmissionRpc,PaidAdmissionError,type PaidActivity,type PaidContext} from '../../shared/paidAdmission.ts';
import {paidProviderFetch,reservationGate} from '../../shared/paidExecution.ts';
import {tutorDigest} from '../../shared/tutorLifecycle.ts';
import type {ResolvedUser} from './auth.ts';
export {paidBindings} from '../../shared/paidBindings.ts';
import {paidBindings} from '../../shared/paidBindings.ts';
export function paidService(env:Record<string,string|undefined>,request:typeof fetch=fetch) {
 if(!env.SUPABASE_URL || !env.SUPABASE_SERVICE_ROLE_KEY)throw new PaidAdmissionError();
 const rpc=paidAdmissionRpc(env.SUPABASE_URL,env.SUPABASE_SERVICE_ROLE_KEY,request);
 const admission=paidAdmission({rpc,bindings:paidBindings(env)});
 return {rpc,admission,
  async transport(userId:string,activity:PaidActivity,context:PaidContext,operationId:string,requestValue:unknown,signal:AbortSignal,timeoutMs=30000) {
   const reservation=await admission.reserve({userId,activity,operationId,context,requestDigest:tutorDigest({operationId,value:requestValue}),signal});
   return paidProviderFetch(reservationGate(reservation,context,signal),request,timeoutMs);
  },
  apiTransport(user:Extract<ResolvedUser,{ok:true}>,activity:PaidActivity,signal:AbortSignal):typeof fetch {
   if(!user.authSessionId)throw new PaidAdmissionError('inactive-owner');
   const operationId=randomUUID(),context:PaidContext={kind:'api',authSessionId:user.authSessionId,operationId};
   let transport:Promise<typeof fetch>|undefined;
   return async(input,init)=>{
    // Phrase source/old quota calls are fixed to this project's DB; never arbitrary hosts.
    const url=new URL(String(input));const db=new URL(env.SUPABASE_URL!);
    if(activity==='phrase-audio' && url.origin===db.origin && url.pathname.startsWith('/rest/v1/'))return request(input,{...init,redirect:'error'});
    transport??=this.transport(user.userId,activity,context,operationId,{activity},signal);
    return (await transport)(input,init);
   };
  },
 };
}
/** Only the two fixed tutor operations are exposed to a DB-key-free worker. */
export function validatePaidTutorCall(value:Record<string,unknown>):{name:'resume_paid_tutor_v1'|'claim_paid_effect_v1';args:Record<string,unknown>;userId:string} {
 if(Object.keys(value).sort().join(',')!=='args,name' || !['resume_paid_tutor_v1','claim_paid_effect_v1'].includes(String(value.name)) || !value.args || typeof value.args!=='object' || Array.isArray(value.args))throw new PaidAdmissionError('invalid-context');
 const args=value.args as Record<string,unknown>;
 const keys=value.name==='resume_paid_tutor_v1'?['p_user_id','p_session_id','p_claim_nonce']:['p_user_id','p_operation_id','p_effect_id','p_component_key','p_configuration_sha256','p_quantities','p_max_provider_attempts','p_context'];
 if(Object.keys(args).length!==keys.length || !keys.every(k=>Object.hasOwn(args,k)) || typeof args.p_user_id!=='string' || !/^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(args.p_user_id))throw new PaidAdmissionError('invalid-context');
 if(value.name==='claim_paid_effect_v1' && (args.p_context as Record<string,unknown>)?.kind!=='tutor')throw new PaidAdmissionError('invalid-context');
 return {name:value.name as 'resume_paid_tutor_v1'|'claim_paid_effect_v1',args,userId:args.p_user_id};
}
