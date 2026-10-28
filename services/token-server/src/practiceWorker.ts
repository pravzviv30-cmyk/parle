import 'dotenv/config';
import { randomUUID } from 'node:crypto';
import { setTimeout as delay } from 'node:timers/promises';
import { brainChoice, brainClientFromEnv, priceUsage } from '@luvani/brain/llm';
import { practiceJobs, processPracticeJob, type PracticeOutcome } from './practiceJobs.ts';
import { tutorSessionRpc } from '../../shared/tutorLifecycle.ts';
import {paidService} from './paidService.ts';
import { safeError } from '../../shared/safeError.ts';

const url = process.env.SUPABASE_URL;
const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
const local = process.env.LUVANI_LOCAL_DEVELOPMENT === '1' && process.env.NODE_ENV !== 'production';
if (process.env.LUVANI_DURABLE_PRACTICE !== '1' || !url || !key
  || (!local && (process.env.NODE_ENV !== 'production' || !url.startsWith('https://') || process.env.LUVANI_LOCAL_DEVELOPMENT === '1'
    || !['anthropic','openai'].includes(brainChoice())))) {
  throw new Error('Practice worker requires durable server configuration and a hosted API brain.');
}
function practiceJobLine(outcome:PracticeOutcome){
  return {result:outcome.result,proposed:outcome.proposed,accepted:outcome.accepted,failure:outcome.failure,generationMs:outcome.generationMs,sinceSessionEndMs:outcome.sinceSessionEndMs,usdEstimate:outcome.usdEstimate};
}
const jobs = practiceJobs(url, key); const rpc = tutorSessionRpc(url,key);
const paid=local?null:paidService(process.env);
const client = brainClientFromEnv(); const workerId=randomUUID();
let stopping = false; let ready = false; const stopController=new AbortController();
const heartbeat=()=>rpc('publish_backend_heartbeat_v1',{p_role:'practice',p_worker_id:workerId,p_ready:ready && !stopping});
let heartbeatWork=Promise.resolve();
const timer=setInterval(()=>{heartbeatWork=heartbeatWork.then(heartbeat).then(()=>{}).catch(()=>{ready=false;});},15_000);
const stop=()=>{stopping=true;ready=false;stopController.abort();};
process.once('SIGTERM',stop);process.once('SIGINT',stop);
try {
  while(!stopping) {
    try {
      const schema=await rpc('tutor_session_schema_v1',{});
      if(schema.version!==1)throw new Error('practice-schema-unavailable');
      let outcome:PracticeOutcome|null=null;
      const result=await processPracticeJob(jobs,client,{onOutcome:value=>{outcome=value;},signal:stopController.signal,...(paid ? {clientFor:async(job,signal)=>brainClientFromEnv(process.env,await paid.transport(job.payload.learnerId,'practice',{kind:'practice',packId:job.pack_id,leaseToken:job.lease_token},job.lease_token,{packId:job.pack_id},signal,90000))} : {}),onUsage:usage=>{
        const priced=priceUsage(usage);
        // Numeric/token counts and a fixed known price row; no text/provider model ID.
        console.log(JSON.stringify({event:'practice_usage',inputTokens:usage.inputTokens,outputTokens:usage.outputTokens,
          cacheReadTokens:usage.cacheReadTokens,cacheWriteTokens:usage.cacheWriteTokens,usdEstimate:priced.usd,priceExact:priced.exact}));
      }});
      ready=true;await heartbeat();
      // Numbers and fixed labels only: no pack, learner, room or model text.
      if(result!=='idle' && outcome)console.log(JSON.stringify({event:'practice_job',...practiceJobLine(outcome)}));
      else if(result!=='idle')console.log(JSON.stringify({event:'practice_job',result}));
      if(!stopping && result==='idle')await delay(5000,undefined,{signal:stopController.signal}).catch(()=>{});
    } catch(error) {
      ready=false;console.error(JSON.stringify({event:'practice_worker_failure',...safeError(error)}));
      if(!stopping)await delay(5000,undefined,{signal:stopController.signal}).catch(()=>{});
    }
  }
} finally { clearInterval(timer);await heartbeatWork;await heartbeat().catch(()=>{}); }
