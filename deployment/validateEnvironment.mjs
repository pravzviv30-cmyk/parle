/** Container admission contract; reports variable names only, never values. */
import { paidBindings } from '../services/shared/paidBindings.ts';
import { validateObservabilityConfig } from './observability.mjs';
import { readFile, stat } from 'node:fs/promises';
const contract=JSON.parse(await readFile(new URL('./environment-contract.json',import.meta.url),'utf8'));
const role=process.argv[2],scope=contract.roles[role],env=process.env;
if(!scope)throw new Error('Unknown backend environment role');
const problems=[];
for(const name of scope.secrets)if(!env[name]?.trim())problems.push(`missing ${name}`);
for(const name of contract.forbiddenProduction)if(env[name]?.trim())problems.push(`forbidden ${name}`);
const assigned=new Set([...scope.secrets,...scope.optionalSecrets]);
const allSecrets=new Set(Object.values(contract.roles).flatMap(s=>[...s.secrets,...s.optionalSecrets]));
for(const name of allSecrets)if(env[name]?.trim() && !assigned.has(name))problems.push(`wrong role secret ${name}`);
if(env.NODE_ENV!=='production' || env.LUVANI_LOCAL_DEVELOPMENT==='1' || env.LUVANI_NATIVE_EVAL==='1' || env.LUVANI_DEV_UNLIMITED_MINUTES==='1')problems.push('development shortcuts enabled');
if(['api','practice'].includes(role) && env.LUVANI_DURABLE_PRACTICE!=='1')problems.push('durable practice required');
if(['api','practice','tutor'].includes(role)) {
  const choice=(env.TUTOR_LLM??'').trim().toLowerCase();
  if(!['anthropic','openai','groq'].includes(choice))problems.push('explicit hosted TUTOR_LLM required');
  if(choice==='groq')problems.push('TUTOR_LLM=groq production rollout requires a separately reviewed degraded privacy contract');
  const key={anthropic:'ANTHROPIC_API_KEY',openai:'OPENAI_API_KEY',groq:'GROQ_API_KEY'}[choice];
  if(key && !env[key]?.trim())problems.push(`missing selected provider ${key}`);
}
if(role==='api' && (env.PORT??'8787')!=='8787')problems.push('API PORT must be8787');
if(role==='api' && env.LUVANI_AGENT_SECRET===env.LUVANI_METRICS_SECRET)problems.push('metrics and agent credentials must differ');
for(const name of ['LUVANI_AGENT_SECRET','LUVANI_METRICS_SECRET','LUVANI_RATE_LIMIT_SALT'])if(assigned.has(name) && (env[name]?.length??0)<32)problems.push(`weak ${name}`);
if(role==='maintenance') {
  const key=env.LUVANI_DELETION_JOURNAL_KEY??'';
  if(!/^[A-Za-z0-9_-]{43}$/.test(key) || Buffer.from(key,'base64url').length!==32 || Buffer.from(key,'base64url').toString('base64url')!==key)problems.push('invalid LUVANI_DELETION_JOURNAL_KEY');
  if((env.LUVANI_DELETION_JOURNAL_TOKEN?.length??0)<32)problems.push('weak LUVANI_DELETION_JOURNAL_TOKEN');
}
for(const [name,protocol] of [['SUPABASE_URL','https:'],['TOKEN_SERVER_URL','https:'],['LIVEKIT_URL','wss:'],['UPSTASH_REDIS_REST_URL','https:'],['LUVANI_DELETION_JOURNAL_URL','https:'],['LUVANI_DELETION_JOURNAL_PROJECT_URL','https:']]) {
  if(!scope.configuration.includes(name))continue;
  try{const u=new URL(env[name]);if(u.protocol!==protocol || u.username || u.password || u.search || u.hash || u.hostname==='localhost')throw new Error();}
  catch{problems.push(`secure explicit ${name} required`);}
}
if(['api','tutor'].includes(role) && (env.LUVANI_SCORING_VENDOR && env.LUVANI_SCORING_VENDOR!=='speechace' || env.SPEECHACE_API_KEY && env.LUVANI_SCORING_VENDOR!=='speechace'))problems.push('explicit supported Speechace scoring required');
if(role==='tutor' && (env.LUVANI_CONVO_ASR_EXPERIMENT==='1' || env.LUVANI_TTS_VENDOR==='fish' || env.LUVANI_TTS_MISS_TRANSPORT==='ws' || env.LUVANI_AUDIO_SCORING==='1' && (env.LUVANI_SCORING_VENDOR!=='speechace' || !env.SPEECHACE_API_KEY)))problems.push('unreviewed paid voice adapter');
if(['api','tutor','practice'].includes(role)) {
 try { const bindings=paidBindings(env);if(!Object.keys(bindings).length)throw new Error(); } catch { problems.push('reviewed LUVANI_PAID_QUOTE_BINDINGS required'); }
}
if(role==='observability') {
 try { const path=env.LUVANI_OBSERVABILITY_CONFIG;if(path!=='/run/config/observability.json')throw new Error();const info=await stat(path);if(!info.isFile() || info.size>16384)throw new Error();const config=validateObservabilityConfig(JSON.parse(await readFile(path,'utf8')));if(!config.enabled || config.listenHost!=='127.0.0.1' || config.listenPort!==9464)throw new Error(); } catch {problems.push('enabled private observability configuration required');}
}
if(problems.length)throw new Error(`Production environment refused (${role}): ${problems.join('; ')}`);
