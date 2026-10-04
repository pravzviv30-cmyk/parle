import {paidAdmission,PaidAdmissionError,type PaidRpc} from '../../shared/paidAdmission.ts';
import {paidBindings} from '../../shared/paidBindings.ts';
import {paidProviderFetch,reservationGate} from '../../shared/paidExecution.ts';
import {boundedFetchJson} from '../../shared/boundedFetch.ts';
import type {SessionLifecycle} from './sessionLifecycle.ts';
/** Scoped resume/dispatch only. This worker never holds a database credential. */
export async function resumePaidRuntime(lifecycle:SessionLifecycle,env:Record<string,string|undefined>=process.env,request:typeof fetch=fetch) {
 const base=new URL(env.TOKEN_SERVER_URL??'');if(base.protocol!=='https:' || base.username || base.password || base.search || base.hash || (env.LUVANI_AGENT_SECRET?.length??0)<32)throw new PaidAdmissionError();
 const rpc:PaidRpc=async(name,args,signal)=>{
  if(!['resume_paid_tutor_v1','claim_paid_effect_v1'].includes(name))throw new PaidAdmissionError();
  const answer=await boundedFetchJson(request,`${base.href.replace(/\/+$/,'')}/agent/paid`,{method:'POST',headers:{'x-luvani-agent':env.LUVANI_AGENT_SECRET!,'content-type':'application/json'},body:JSON.stringify({name,args})},{timeoutMs:5000,maxBytes:32768,...(signal?{signal}:{})});
  if(answer.status!==200)throw new PaidAdmissionError();return answer.value;
 };
 const identity=lifecycle.paidIdentity();const reservation=await paidAdmission({rpc,bindings:paidBindings(env)}).resume({...identity,signal:lifecycle.signal});
 lifecycle.assertActive();const gate=reservationGate(reservation,{kind:'tutor',sessionId:identity.sessionId,claimNonce:identity.claimNonce},lifecycle.signal);
 return {gate,transport:paidProviderFetch(gate),reservation};
}
