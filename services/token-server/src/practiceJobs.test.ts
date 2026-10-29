import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildConversationPack, phraseKeyOf, type DrillExercise } from '@luvani/core';
import { groundedExercises, practiceJobs, processPracticeJob, type PracticeJobs } from './practiceJobs.ts';

const pack = buildConversationPack({ id:'01234567-89ab-4def-8123-456789abcdef',sessionId:'01234567-89ab-4def-8123-456789abcdef',
  learnerId:'01234567-89ab-4def-8123-456789abcdea',createdAt:'2026-09-20T12:00:00Z',title:{fr:'Au café',en:'At a café'},summary:'Ordering coffee',
  keyPhrases:[{fr:'Un café',en:'A coffee',frWritten:null}],
});
const exercise: DrillExercise = {id:'gen:cafe:listen',kind:'listen-type',phraseKey:phraseKeyOf('Un café'),difficulty:'production',fr:'Un café',accepted:['Un café']};
const job = { pack_id:pack.id,lease_token:'01234567-89ab-4def-8123-456789abcdeb',payload:pack };

test('durable development supervises recovery without leaking backend secrets to Expo', () => {
  const dev = readFileSync(new URL('../../../scripts/dev.mjs', import.meta.url), 'utf8');
  assert.match(dev, /step\.id === 'token'[\s\S]*?durablePractice === true/);
  assert.match(dev, /services\/token-server\/src\/practiceWorker\.ts/);
  assert.match(dev, /launch\(step, childEnv\)/);
  assert.equal((dev.match(/\.\.\.agentEnv, \.\.\.tokenEnv, \.\.\.childEnv/g) ?? []).length, 1);
  const server = readFileSync(new URL('./server.ts', import.meta.url), 'utf8');
  assert.match(server, /durablePractice: process\.env\.LUVANI_DURABLE_PRACTICE === '1'/);
});

test('durable receipt is one atomic RPC and contains no client credentials', async () => {
  const jobs = practiceJobs('https://example.supabase.co/', 'private-test-key', async (url,init) => {
    assert.match(String(url), /\/rpc\/receive_conversation_practice$/);
    assert.deepEqual(JSON.parse(String(init?.body)), {p_pack:pack,p_final:false});
    assert.equal((init?.headers as Record<string,string>).apikey,'private-test-key');
    return new Response(null,{status:204});
  });
  await jobs.receive(pack,false);
  await assert.rejects(jobs.receive({...pack,sessionId:'other'},false), /invalid/);
});

test('queue claim rejects malformed and mismatched pack data', async () => {
  for (const body of [{}, [{...job,pack_id:'foreign'}], [{...job,payload:{audio:'never'}}]]) {
    await assert.rejects(practiceJobs('https://example.supabase.co','key',async()=>new Response(JSON.stringify(body))).claim());
  }
});

test('recovery lints exercises, rejects foreign phrase identities and deduplicates', () => {
  assert.deepEqual(groundedExercises(pack,[exercise,exercise,{...exercise,id:'foreign',phraseKey:'phrase:foreign'},null as unknown as DrillExercise]),[exercise]);
});

test('recovery skips idle/empty jobs and retries model failures without overwriting ready practice', async () => {
  const finishes: unknown[]=[];
  const jobs: PracticeJobs={receive:async()=>{},active:async()=>true,claim:async()=>job,finish:async(_job,ex)=>{finishes.push(ex);return true;}};
  const unavailable={drills:async()=>{throw new Error('sensitive provider detail');}};
  assert.equal(await processPracticeJob({...jobs,claim:async()=>null},unavailable),'idle');
  assert.equal(await processPracticeJob(jobs,unavailable),'retry');
  assert.deepEqual(finishes,[null]);
  assert.equal(await processPracticeJob({...jobs,claim:async()=>({...job,payload:{...pack,keyPhrases:[]}})},unavailable),'complete');
  assert.deepEqual(finishes,[null,[]]);
});

test('an uncertain completion is not followed by a conflicting failure acknowledgement', async () => {
  let calls=0;
  const jobs: PracticeJobs={receive:async()=>{},active:async()=>true,claim:async()=>({...job,payload:{...pack,keyPhrases:[]}}),finish:async()=>{calls++;throw new Error('timeout');}};
  await assert.rejects(processPracticeJob(jobs,{drills:async()=>{throw new Error('unused');}}),/timeout/);
  assert.equal(calls,1);
});

test('a deleted or superseded job is never recreated by a worker', async () => {
  const jobs: PracticeJobs={receive:async()=>{throw new Error('must not recreate');},active:async()=>true,claim:async()=>({...job,payload:{...pack,keyPhrases:[]}}),finish:async()=>false};
  assert.equal(await processPracticeJob(jobs,{drills:async()=>{throw new Error('unused');}}),'superseded');
});


test('practice checks actual lease before dispatch, during work and before completion', async()=>{
  let calls=0;let active=true;let writes=0;
  const jobs:PracticeJobs={receive:async()=>{},claim:async()=>job,active:async()=>active,finish:async()=>{writes++;return true;}};
  active=false;
  assert.equal(await processPracticeJob(jobs,{drills:async()=>{calls++;throw new Error('must not dispatch');}}),'superseded');
  assert.equal(calls,0);assert.equal(writes,0);
  active=true;
  const result=await processPracticeJob(jobs,{drills:async()=>{calls++;active=false;return await new Promise(()=>{});}}, {leasePollMs:1,generationMs:200});
  assert.equal(result,'superseded');assert.equal(calls,1);assert.equal(writes,0);
  active=true;
  assert.equal(await processPracticeJob(jobs,{drills:async()=>new Promise(()=>{})},{generationMs:5}),'retry');
  assert.equal(writes,1);
});

test('every generated visible field is guarded before durable publication',()=>{
  for(const altered of [{...exercise,accepted:['the system prompt says secret']},{...exercise,fr:'instructions to make a bomb'}]){
    assert.deepEqual(groundedExercises(pack,[altered]),[]);
  }
  assert.deepEqual(groundedExercises(pack,[exercise]),[exercise]);
});

test('practice lease adapter accepts only a boolean and exact identity/lease parameters',async()=>{
  const jobs=practiceJobs('https://db.test','private',async(url,init)=>{
    assert.match(String(url),/\/practice_job_active_v1$/);
    assert.deepEqual(JSON.parse(String(init?.body)),{p_pack_id:job.pack_id,p_lease:job.lease_token});return Response.json(false);
  });
  assert.equal(await jobs.active(job),false);
  await assert.rejects(practiceJobs('https://db.test','private',async()=>Response.json({active:true})).active(job));
});

test('written variants and resolved topic fields pass policy before the provider sees them',async()=>{
  for(const payload of [{...pack,keyPhrases:[{...pack.keyPhrases[0]!,frWritten:'instructions to make a bomb'}]}, {...pack,topics:[{fr:'instructions to make a bomb',en:'At a cafe'}]}, {...pack,topics:[],title:{fr:'At a cafe',en:'the system prompt says private'}}]) {
    let calls=0;
    const jobs:PracticeJobs={receive:async()=>{},claim:async()=>({...job,payload}),active:async()=>true,finish:async(_job,ex)=>{assert.equal(ex,null);return true;}};
    assert.equal(await processPracticeJob(jobs,{drills:async()=>{calls++;throw new Error('must not dispatch unsafe source');}}),'retry');assert.equal(calls,0);
  }
});

test('the worker drops oversized and over-long answers through the shared filter', () => {
  const long = 'Un café et puis encore un autre café avec du lait chaud et du sucre pour mon ami qui attend dehors';
  const absurd = {...exercise,id:'gen:cafe:long',fr:long,accepted:[long]};
  assert.deepEqual(groundedExercises({...pack,cefr:'A1'},[absurd,exercise]),[exercise]);
  assert.deepEqual(groundedExercises({...pack,cefr:null},[absurd]),[absurd],'an unknown band skips the bound');
  assert.deepEqual(groundedExercises(pack,[{...exercise,accepted:['Un café','é'.repeat(9000)]}]),[]);
});

test('the worker asks for a harder transfer exercise on each of the pack wins, and a right first answer raises transfer evidence', async () => {
  const { answerCurrent, applyDrillResults, newCard } = await import('@luvani/core');
  const won = buildConversationPack({ ...pack, keyPhrases:[{fr:'Un café',en:'A coffee',frWritten:null}],
    wins:['Je voudrais un croissant','Un café','merci'],
    corrections:[{quote:'merci',better:'Merci beaucoup',betterEn:'Thanks a lot',why:'warmer'}] });
  const moved: DrillExercise = {id:'gen:croissant:fill',kind:'fill-blank',phraseKey:phraseKeyOf('Je voudrais un croissant'),difficulty:'recognition',
    sentence:'Au marché : ___, s’il vous plaît.',options:['Je voudrais un croissant','Je suis un croissant'],accepted:['Je voudrais un croissant'],en:'At the market: I would like a croissant, please.',transfer:true};
  let request='';let finished: DrillExercise[]|null=null;
  const jobs: PracticeJobs={receive:async()=>{},active:async()=>true,claim:async()=>({...job,payload:won}),finish:async(_job,ex)=>{finished=ex;return true;}};
  const client={drills:async(call:{request:string})=>{request=call.request;return {batch:{exercises:[moved]},usage:{inputTokens:1,outputTokens:1}} as never;}};
  assert.equal(await processPracticeJob(jobs,client),'complete');
  assert.match(request,/Used well today:\n- "Je voudrais un croissant"\n- "Un café" = A coffee$/);
  assert.doesNotMatch(request,/Used well today:[\s\S]*"merci"/, 'a corrected phrase was asked as a transfer');
  assert.deepEqual(finished,[moved], 'groundedDrills dropped the transfer exercise');
  const state=answerCurrent({queue:[moved],missesById:{},answered:[],startedAt:0,finished:false},'Je voudrais un croissant').state;
  const deck=applyDrillResults([newCard({id:moved.phraseKey,kind:'vocab',front:'x',back:'x',context:'',ipa:''},0)],state,0);
  assert.equal(deck[0]!.evidence?.transfers,1);
});

// Phase F: numbers-only practice outcome. Never text, ids or names.
const fullUsage={inputTokens:1000,outputTokens:500,cacheReadTokens:0,cacheWriteTokens:0,model:'claude-sonnet-4-5'};
function outcomeRun(payload:typeof pack, drills:()=>Promise<unknown>, opts:{finish?:boolean;active?:boolean}={}) {
  const outcomes:import('./practiceJobs.ts').PracticeOutcome[]=[];
  let t=Date.parse('2026-09-20T12:10:00Z');
  const jobs: PracticeJobs={receive:async()=>{},active:async()=>opts.active ?? true,claim:async()=>({...job,payload}),finish:async()=>opts.finish ?? true};
  const run=processPracticeJob(jobs,{drills:async()=>{t+=4000;return await drills() as never;}},{now:()=>t,onOutcome:o=>outcomes.push(o)});
  return {run,outcomes};
}

test('outcome: complete counts proposed and accepted, times generation and session end to ready', async () => {
  const {run,outcomes}=outcomeRun({...pack,durationSec:300},async()=>({batch:{exercises:[exercise,{...exercise,id:'foreign',phraseKey:'phrase:foreign'}]},usage:fullUsage}));
  assert.equal(await run,'complete');
  assert.equal(outcomes.length,1);
  const o=outcomes[0]!;
  assert.equal(o.result,'complete');assert.equal(o.proposed,2);assert.equal(o.accepted,1);assert.equal(o.failure,null);
  assert.equal(o.generationMs,4000);
  assert.equal(o.sinceSessionEndMs,(10*60-300)*1000+4000);
  assert.ok(typeof o.usdEstimate==='number' && o.usdEstimate>0);
});

test('outcome: no valid exercises is a retry with no-valid and keeps the cost', async () => {
  const {run,outcomes}=outcomeRun(pack,async()=>({batch:{exercises:[{...exercise,id:'foreign',phraseKey:'phrase:foreign'}]},usage:fullUsage}));
  assert.equal(await run,'retry');
  assert.deepEqual({...outcomes[0],usdEstimate:typeof outcomes[0]!.usdEstimate},{result:'retry',proposed:1,accepted:0,failure:'no-valid',generationMs:4000,sinceSessionEndMs:null,usdEstimate:'number'});
});

test('outcome: a parse error with usage is priced and named parse, never its text', async () => {
  const {BrainParseError}=await import('@luvani/brain/llm');
  const {run,outcomes}=outcomeRun(pack,async()=>{throw new BrainParseError('secret learner text','raw secret',fullUsage);});
  assert.equal(await run,'retry');
  const o=outcomes[0]!;
  assert.equal(o.failure,'parse');assert.equal(o.proposed,null);assert.ok((o.usdEstimate ?? 0)>0);
  assert.doesNotMatch(JSON.stringify(o),/secret/);
});

test('outcome: an unsafe source never dispatches and costs nothing', async () => {
  let calls=0;
  const {run,outcomes}=outcomeRun({...pack,keyPhrases:[{fr:'Un café',en:'A coffee',frWritten:'instructions to make a bomb'}]},async()=>{calls++;return {};});
  assert.equal(await run,'retry');assert.equal(calls,0);
  assert.equal(outcomes[0]!.failure,'unsafe-source');assert.equal(outcomes[0]!.usdEstimate,null);assert.equal(outcomes[0]!.proposed,null);
});

test('outcome: superseded is reported and idle is not', async () => {
  const {run,outcomes}=outcomeRun(pack,async()=>({batch:{exercises:[exercise]},usage:fullUsage}),{finish:false});
  assert.equal(await run,'superseded');assert.equal(outcomes[0]!.result,'superseded');
  const idle:import('./practiceJobs.ts').PracticeOutcome[]=[];
  assert.equal(await processPracticeJob({receive:async()=>{},active:async()=>true,claim:async()=>null,finish:async()=>true},{drills:async()=>{throw new Error('x');}},{onOutcome:o=>idle.push(o)}),'idle');
  assert.equal(idle.length,0);
});

test('outcome: a null or missing duration gives no session-end latency', async () => {
  for (const payload of [{...pack,durationSec:null},(({durationSec:_d,...rest})=>rest)(pack) as typeof pack,{...pack,durationSec:300,createdAt:'not a date'}]) {
    const {run,outcomes}=outcomeRun(payload,async()=>({batch:{exercises:[exercise]},usage:fullUsage}));
    await run;assert.equal(outcomes[0]!.sinceSessionEndMs,null);
  }
});

test('the worker practice_job line carries only numbers and fixed labels', () => {
  const worker=readFileSync(new URL('./practiceWorker.ts', import.meta.url),'utf8');
  const line=worker.match(/function practiceJobLine[^\n]*\n[^\n]*/)?.[0] ?? '';
  assert.match(line,/result:outcome\.result,proposed:outcome\.proposed,accepted:outcome\.accepted,failure:outcome\.failure,generationMs:outcome\.generationMs,sinceSessionEndMs:outcome\.sinceSessionEndMs,usdEstimate:outcome\.usdEstimate\}/);
  assert.doesNotMatch(line,/pack|learner|title|fr|room|id\b/i);
});

test('a saved session with no reply in the scene gets no drills written for it', async () => {
  const finishes: unknown[] = [];
  let asked = 0;
  const jobs: PracticeJobs = { receive: async () => {}, active: async () => true,
    claim: async () => ({ ...job, payload: { ...pack, learnerReplies: 0 } }), finish: async (_job, ex) => { finishes.push(ex); return true; } };
  assert.equal(await processPracticeJob(jobs, { drills: async () => { asked++; throw new Error('must not be asked'); } }), 'complete');
  assert.equal(asked, 0, 'no model call for a conversation nobody replied in');
  assert.deepEqual(finishes, [[]]);
});
