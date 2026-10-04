import assert from 'node:assert/strict';
import { randomBytes } from 'node:crypto';
import { jwtVerify } from 'jose';
import { test } from 'node:test';
import { TutorSessionRepository } from './tutorSessions.ts';
import { grantSession } from './tokens.ts';
const userId='11111111-1111-4111-8111-111111111111',sessionId='22222222-2222-4222-8222-222222222222',authSessionId='33333333-3333-4333-8333-333333333333';
const input={userId,sessionId,authSessionId,roomName:`luvani-${sessionId}`,mode:'convo' as const,request:{mode:'convo'}};
const row={kind:'reserved',version:1,...input,plan:'starter',reservedSeconds:600,secondsRemaining:900,joinDeadline:new Date(Date.now()+45000).toISOString()};
test('validated SQL reservation controls a cryptographically verified JWT despite a spent local snapshot',async()=>{
  const admitted=await new TutorSessionRepository('https://synthetic.test','synthetic',async(_url,init)=>{
    const args=JSON.parse(String(init?.body));assert.equal(args.p_auth_session_id,authSessionId);assert.match(args.p_request_digest,/^[a-f0-9]{64}$/);return Response.json(row);
  }).reserve(input);
  if(admitted.kind!=='reserved')assert.fail('reservation expected');
  const config={apiKey:randomBytes(12).toString('hex'),apiSecret:randomBytes(32).toString('hex')};
  const result=await grantSession({userId,mode:'convo',lessonId:'cafe-01',entitlement:{plan:'trial',secondsUsed:1800},config,admitted});
  if(!result.ok)assert.fail('authoritatively reserved grant refused');
  const {payload}=await jwtVerify(result.grant.token,new TextEncoder().encode(config.apiSecret),{issuer:config.apiKey,algorithms:['HS256']});
  const meta=JSON.parse(String(payload.metadata));assert.equal(payload.sub,userId);assert.equal((payload.video as {room:string}).room,input.roomName);
  assert.equal(meta.sessionId,sessionId);assert.equal(meta.mode,'convo');assert.equal(meta.secondsRemaining,600);assert.equal(meta.lifecycleVersion,1);assert.equal(result.grant.secondsRemaining,900);
  await assert.rejects(grantSession({userId:authSessionId,mode:'convo',lessonId:'cafe-01',entitlement:{plan:'trial',secondsUsed:0},config,admitted}));
  await assert.rejects(grantSession({userId,mode:'lesson',lessonId:'cafe-01',entitlement:{plan:'trial',secondsUsed:0},config,admitted}));
  assert.equal((await grantSession({userId,lessonId:'cafe-01',entitlement:{plan:'trial',secondsUsed:1800},config})).ok,false);
});
test('service reservation decoder rejects malformed allowance and identity bindings',async()=>{
  for(const bad of [{version:2},{userId:authSessionId},{sessionId:userId},{roomName:'foreign'},{mode:'lesson'},{plan:'toString'},{reservedSeconds:119},{reservedSeconds:901},{reservedSeconds:120.5},{secondsRemaining:599},{secondsRemaining:999999999},{joinDeadline:'invalid'}]) {
    await assert.rejects(new TutorSessionRepository('https://synthetic.test','synthetic',async()=>Response.json({...row,...bad})).reserve(input));
  }
});
