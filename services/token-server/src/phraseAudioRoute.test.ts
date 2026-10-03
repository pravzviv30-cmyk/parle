import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { EventEmitter } from 'node:events';
import type { IncomingMessage,ServerResponse } from 'node:http';
import { handlePhraseAudio,type PhraseAudioDeps } from './phraseAudioRoute.ts';
const source={packId:'33333333-3333-4333-8333-333333333333',kind:'phrase',index:0};
function req(body:unknown,url='/phrase-audio/manifest',headers:Record<string,string>={}) {const stream=Readable.from([Buffer.from(JSON.stringify(body))]) as unknown as IncomingMessage;stream.url=url;stream.headers={authorization:'Bearer test',...headers};return stream;}
function response(){let status=0;let body:unknown;const res=Object.assign(new EventEmitter(),{writeHead:(s:number)=>{status=s;},end:(text:string)=>{body=JSON.parse(text);}}) as unknown as ServerResponse;return {res,status:()=>status,body:()=>body};}
function deps(overrides:Partial<PhraseAudioDeps>={}):PhraseAudioDeps{return {users:{resolve:async()=>({ok:true,userId:'owner'})},limits:async()=>true,env:{},request:async()=>{throw new Error('must not dispatch');},...overrides};}
test('saved audio authenticates and refuses arbitrary posted text, URLs or bad source before synthesis',async()=>{
 for(const [body,url] of [[{source,voice:'marie',text:'private words'},'/phrase-audio/manifest'],[{source:{...source,index:64},voice:'marie'},'/phrase-audio/manifest'],[{source,voice:'unknown'},'/phrase-audio/manifest'],[{source,voice:'marie'},'/phrase-audio/manifest?text=private']] as const){const r=response();await handlePhraseAudio(req(body,url),r.res,false,deps());assert.equal(r.status(),400);assert.ok(!JSON.stringify(r.body()).includes('private'));}
 const r=response();await handlePhraseAudio(req({source,voice:'marie'}),r.res,false,deps({users:{resolve:async()=>({ok:false,status:401,message:'auth required'})}}));assert.equal(r.status(),401);
});
test('closing saved audio while authentication is held begins no late database or vendor request',async()=>{
 let finish!:(value:{ok:true;userId:string})=>void;let calls=0;const r=response();
 const pending=handlePhraseAudio(req({source,voice:'marie'}),r.res,false,deps({users:{resolve:()=>new Promise(resolve=>{finish=resolve;})},request:async()=>{calls++;throw new Error('unexpected');}}));
 await new Promise(resolve=>setImmediate(resolve));r.res.emit('close');await pending;finish({ok:true,userId:'owner'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});
test('saved audio bounds stalled authentication and never dispatches after its request deadline',async()=>{
 let finish!:(value:{ok:true;userId:string})=>void;let calls=0;const r=response();
 await handlePhraseAudio(req({source,voice:'marie'}),r.res,false,deps({timeoutMs:5,users:{resolve:()=>new Promise(resolve=>{finish=resolve;})},request:async()=>{calls++;throw new Error('unexpected');}}));
 assert.equal(r.status(),503);finish({ok:true,userId:'owner'});await new Promise(resolve=>setImmediate(resolve));assert.equal(calls,0);
});
