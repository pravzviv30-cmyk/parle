import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { parseFirstPracticeBrief, firstPracticeScenario, secondsRemaining, buildConversationPack } from '@luvani/core';
import { MemoryGuestStore, createGuest, guestKey, claimGuest } from './onboardingGuest.ts';
import { prepareGuestLive, guestLiveResult, endGuestLive } from './guestLive.ts';
import { grantSession } from './tokens.ts';
const source = readFileSync(new URL('./server.ts',import.meta.url),'utf8');
const start = source.indexOf("    if (req.method === 'POST' && url.pathname.startsWith('/onboarding/')) {");
const end = source.indexOf("\n    // RevenueCat's event is a doorbell",start);
assert.ok(start > 0 && end > start);
const js = stripTypeScriptTypes(`async function branch() {${source.slice(start,end)}}`);
const AsyncFunction = Object.getPrototypeOf(async()=>{}).constructor;
const brief = {version:1,goals:['trip','food'],level:'zero',confidence:'hesitant',focus:'speaking',minutes:20,tutorVoice:'emilie'};
function harness(production = false, spokenAvailable = true) {
  const guestStore = new MemoryGuestStore(), saved = new Map<string,unknown>(), consumed = new Set<string>(); let failSave = false;
  const store = { get: async()=>({plan:'trial' as const,secondsUsed:0}),recordSessionGrant:async()=>true,consume:async(_user:string,_seconds:number,id:string)=>{consumed.add(id);} };
  async function call(path:string,{installation='device',token,body={},user='account-a'}: {installation?:string;token?:string;body?:Record<string,unknown>;user?:string|null} = {}) {
    const response:{status:number;body:Record<string,unknown>} = {status:0,body:{}};
    const world = { req:{method:'POST',headers:{'x-luvani-guest':token,authorization:user}},url:{pathname:path,search:''},res:{},
      json:(_res:unknown,status:number,value:Record<string,unknown>)=>{response.status=status;response.body=value;},
      installationSignal:()=>installation,privateSignal:(_salt:unknown,_kind:unknown,value:unknown)=>value,rateLimitSalt:'fixture',withinLimits:async()=>true,ipCheck:()=>[],
      GUEST_START_LIMIT:{},GUEST_EVENT_LIMIT:{},GUEST_REPLY_LIMIT:{},readJson:async()=>body,
      process:{env:{NODE_ENV:production?'production':'test',LUVANI_LOCAL_DEVELOPMENT:'1',LUVANI_GUEST_LIVE:'1',SUPABASE_URL:'https://fixture.invalid',SUPABASE_SERVICE_ROLE_KEY:'fixture'}},
      AGENT_SECRET:'fixture',supportsSessionMode:()=>spokenAvailable,supportedSessionModes:()=>spokenAvailable?['lesson','convo','lesson-text','convo-text']:['lesson-text','convo-text'],parseFirstPracticeBrief,firstPracticeScenario,guestStore,createGuest,guestKey,prepareGuestLive,guestLiveResult,endGuestLive,claimGuest,
      grantSession,config:{apiKey:'devkey',apiSecret:'fixture-secret-long-enough-for-hmac-signing'},livekitUrl:'wss://fixture.invalid',
      users:{resolve:async(header:string|null)=>header?{ok:true,userId:header}:{ok:false,status:401,message:'sign in required'}},
      saveConversationPack:async(_url:string,_key:string,pack:{sessionId:string})=>{if(failSave)throw new Error('database unavailable');saved.set(pack.sessionId,pack);},
      claimTrialWithEvidence:async()=>true,store,eventSink:undefined,secondsRemaining,
    };
    await new AsyncFunction(...Object.keys(world),js.slice(js.indexOf('{')+1,js.lastIndexOf('}')))(...Object.values(world));
    return response;
  }
  return {call,guestStore,saved,consumed,failSave:(value:boolean)=>{failSave=value;}};
}
test('production fails closed even with local or guest flags until paid guest admission is supported', async()=>{
  const h=harness(true),r=await h.call('/onboarding/start',{body:{live:true,eligible:true,brief}});
  assert.equal(r.status,503);assert.equal(h.guestStore.rows.size,0);
  assert.equal(r.body.error,'guest-live-unavailable','the account route must distinguish disabled guest admission from a transient connection failure');
});
test('a typed-only service never claims that creating an account will restore speaking', async()=>{
  for (const production of [false,true]) {
    const h=harness(production,false),r=await h.call('/onboarding/start',{body:{live:true,eligible:true,brief}});
    assert.equal(r.status,503);assert.equal(r.body.error,'voice-unavailable');
    assert.match(String(r.body.message),/speaking.*unavailable/i);
    assert.match(String(r.body.message),/signed-in.*typing/i);
    assert.doesNotMatch(String(r.body.message),/create an account to start live practice/i);
    assert.deepEqual(r.body.supportedModes,['lesson-text','convo-text']);
    assert.equal(h.guestStore.rows.size,0,'unsupported speech must reserve no guest capability');
  }
});
test('local guest start binds the actual brief and one room, rejects another installation and ignores forged completion',async()=>{
  const h=harness(),r=await h.call('/onboarding/start',{body:{live:true,eligible:true,brief}});assert.equal(r.status,200);
  const token=r.body.token as string;
  assert.equal((await h.call('/onboarding/live',{token,installation:'other'})).status,401);
  const grant=await h.call('/onboarding/live',{token,body:{completed:true,seconds:9999}});assert.equal(grant.status,200);assert.equal(grant.body.secondsRemaining,1260);
  const claims=JSON.parse(Buffer.from((grant.body.token as string).split('.')[1]!,'base64url').toString());
  assert.deepEqual(JSON.parse(claims.metadata).firstPractice,brief);
  assert.equal((await h.call('/onboarding/live-result',{token})).body.outcome,'active');
  assert.equal((await h.call('/onboarding/end',{token})).body.outcome,'partial');
});
test('account transfer retries the authoritative pack after storage failure and removes its temporary copy only after success',async()=>{
  const h=harness(),r=await h.call('/onboarding/start',{body:{live:true,eligible:true,brief}}),token=r.body.token as string,key=guestKey(token);
  const row=(await h.guestStore.get(key))!,live=row.live!;
  const pack=buildConversationPack({id:live.sessionId,sessionId:live.sessionId,learnerId:row.id,createdAt:new Date().toISOString(),title:{fr:'Au restaurant',en:'At the restaurant'},summary:'A conversation.',keyPhrases:[]});
  await h.guestStore.update(key,row=>{row.live!.baseline=pack;row.live!.endedAt=Date.now();row.live!.outcome='completed';row.seconds=20;});
  assert.equal((await h.call('/onboarding/claim',{token,user:null})).status,401);
  h.failSave(true);await assert.rejects(h.call('/onboarding/claim',{token}));assert.ok((await h.guestStore.get(key))!.live!.baseline);
  h.failSave(false);assert.equal((await h.call('/onboarding/claim',{token})).status,200);
  // D24: the first scene is a gift on top of the weekly free taste, never a debit from it.
  assert.equal(h.saved.size,1);assert.equal(h.consumed.size,0,'the guest first scene was charged to the weekly taste');assert.equal((h.saved.get(live.sessionId) as {learnerId:string}).learnerId,'account-a');
  assert.equal((await h.guestStore.get(key))!.live!.baseline,null);
  assert.equal((await h.call('/onboarding/claim',{token})).status,200);assert.equal(h.saved.size,1);assert.equal(h.consumed.size,0);
  assert.equal((await h.call('/onboarding/claim',{token,user:'account-b'})).status,409);
});
