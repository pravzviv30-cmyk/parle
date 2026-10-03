import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { claimTrialWithEvidence, recordMinutesRefusal } from './sessionEvents.ts';
import { InMemoryEntitlementStore } from './store.ts';
import { parseProductEvent } from './productEvents.ts';
const sink = { baseUrl: 'https://db.invalid/', serviceRoleKey: 'server-secret' };

test('the first trial claim and every refusal over minutes are recorded as product events', async () => {
 const calls: {url: string; body: Record<string,unknown>}[]=[];
 const request: typeof fetch = async (url, init) => { calls.push({url:String(url),body:JSON.parse(String(init?.body))}); return Response.json(true); };
 const store=new InMemoryEntitlementStore();
 for (const allowed of [true,false,'true',null]) {
  assert.equal(await claimTrialWithEvidence(store,sink,'owner','installation','marker',allowed,request),true);
  assert.equal(calls.at(-1)?.body.p_analytics_allowed,allowed===true);
  assert.equal(calls.at(-1)?.body.p_user_id,'owner');
 }
 calls.length=0;
 for (const reason of ['exhausted','insufficient-for-session']) await recordMinutesRefusal(sink,'owner',true,{plan:'trial',secondsUsed:1800},reason,request);
 assert.equal(calls.length,2);
 assert.deepEqual(calls[0]?.body,{user_id:'owner',name:'minutes_refused',properties:{plan:'trial',reason:'exhausted'}});
 calls.length=0;
 for (const allowed of [false,'true',null,undefined]) await recordMinutesRefusal(sink,'owner',allowed,{plan:'trial',secondsUsed:1800},'exhausted',request);
 for (const reason of ['subscription-lapsed','trial already claimed','unknown']) await recordMinutesRefusal(sink,'owner',true,{plan:'starter',secondsUsed:0},reason,request);
 assert.equal(calls.length,0);
 await recordMinutesRefusal(sink,'owner',true,{plan:'trial',secondsUsed:1800},'exhausted',async()=>{throw new Error('sink unavailable');});
 const server=readFileSync(new URL('server.ts',import.meta.url),'utf8');
 assert.match(server,/claimTrialWithEvidence\([\s\S]*?store instanceof SupabaseEntitlementStore \? eventSink : null[\s\S]*?body.analyticsAllowed/);
 assert.match(server,/if \(!result.ok\) \{\s*void recordMinutesRefusal\(eventSink, userId, body.analyticsAllowed, entitlement, result.reason\);/);
});

test('only the missing forward RPC falls back; money errors and bad shapes stay refused', async () => {
 let legacy=0;
 const store=new InMemoryEntitlementStore(); store.claimTrial=async()=>{legacy++;return true;};
 assert.equal(await claimTrialWithEvidence(store,null,'u','i','h',true),true); assert.equal(legacy,1);
 assert.equal(await claimTrialWithEvidence(store,sink,'u','i','h',true,async()=>Response.json({code:'PGRST202'},{status:404})),true); assert.equal(legacy,2);
 for (const response of [Response.json({code:'different'},{status:404}),Response.json({code:'PGRST202'},{status:500})]) await assert.rejects(claimTrialWithEvidence(store,sink,'u','i','h',true,async()=>response),/trial claim failed/);
 assert.equal(legacy,2);
 for (const answer of ['true',{},null,false]) assert.equal(await claimTrialWithEvidence(store,sink,'u','i','h',true,async()=>Response.json(answer)),false);
});

test('the client cannot submit service facts, enum coercions or text disguised as funnel evidence',()=>{
 for (const event of [{name:'trial_started',properties:{}},{name:'minutes_refused',properties:{plan:'trial',reason:'exhausted'}}]) {
  assert.equal(parseProductEvent(event),null); assert.deepEqual(parseProductEvent(event,'server'),event);
 }
 assert.equal(parseProductEvent({name:'restore_started',properties:{entry:['wall']}}),null);
 assert.equal(parseProductEvent({name:'restore_settled',properties:{entry:'wall',outcome:'done',text:'bonjour'}}),null);
});
