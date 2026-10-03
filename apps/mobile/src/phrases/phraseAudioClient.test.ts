import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import { stripTypeScriptTypes } from 'node:module';
import { isTutorVoiceKey,phraseAudioFrench,readPhraseAudioSource } from '@luvani/core';
import { createPhraseAudioCache,isPhraseAudioWav,type PhraseAudioFiles } from './phraseAudioCache.ts';
const source={packId:'33333333-3333-4333-8333-333333333333',kind:'phrase' as const,index:0},french='Un café, merci.';
const sha=(value:string)=>createHash('sha256').update(value).digest('hex');
function wav(){const b=new Uint8Array(46),v=new DataView(b.buffer);for(const[at,s]of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']]as const)for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);v.setUint32(4,38,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,2,true);return b;}
function setup(){
 const state={owner:1,user:'owner',headers:async()=>({authorization:'Bearer fake'}),session:async()=>({id:'owner'}),calls:[] as string[],generation:0,manifestFrench:french,onCacheRead:()=>{},onBody:()=>{},onCommit:()=>{}};
 const files=new Map<string,{key:string;uri:string;bytes:number;usedAt:number}>();let sequence=0;
 const ports:PhraseAudioFiles={entries:async()=>{state.onCacheRead();return [...files.values()].filter(row=>row.key!=='');},temporary:async bytes=>{const uri=`file:///private/${++sequence}`;files.set(uri,{key:'',uri,bytes:bytes.length,usedAt:sequence});return uri;},commit:async(uri,key)=>{files.get(uri)!.key=key;state.onCommit();return uri;},touch:async()=>{},remove:async uri=>{files.delete(uri);},clear:async()=>{files.clear();}};
 const resets:(()=>void)[]=[],cleanups:(()=>Promise<void>)[]=[];
 const bindings={Crypto:{CryptoDigestAlgorithm:{SHA256:'SHA256'},digestStringAsync:async(_kind:string,value:string)=>sha(value)},isTutorVoiceKey,phraseAudioFrench,readPhraseAudioSource,auth:{getSession:()=>state.session()},authHeaders:()=>state.headers(),activeUserId:()=>state.user,onUserScopeCleanup:(fn:()=>Promise<void>)=>cleanups.push(fn),onUserScopeReset:(fn:()=>void)=>resets.push(fn),scopeGeneration:()=>state.owner,writeInUserScope:async(owner:number,write:()=>Promise<void>)=>{if(owner!==state.owner)return false;await write();return owner===state.owner;},TOKEN_SERVER:'https://tokens.invalid',createPhraseAudioCache,isPhraseAudioWav,phraseAudioFiles:ports,fetch:async(url:string,init:RequestInit)=>{
  state.calls.push(url);assert.equal(init.redirect,'error');assert.equal((init.headers as Record<string,string>)['x-luvani-user'],'owner');const body=JSON.parse(init.body as string);assert.equal('text' in body,false);assert.equal('fr' in body,false);
  if(url.endsWith('/manifest'))return Response.json({source,voice:body.voice,fr:state.manifestFrench,frenchHash:sha(state.manifestFrench),fingerprint:sha(body.voice)});
  state.generation++;const result=new Response(wav(),{headers:{'content-length':'46','content-type':'audio/wav'}});const readBytes=result.arrayBuffer.bind(result);result.arrayBuffer=async()=>{state.onBody();return readBytes();};return result;
 }};
 const production=stripTypeScriptTypes(readFileSync(new URL('./phraseAudioClient.ts',import.meta.url),'utf8').split('\n').filter(line=>!line.startsWith('import ')).join('\n').replace(/^export /gm,''));
 const client=new Function(...Object.keys(bindings),production+'\nreturn keptPhraseAudio;')(...Object.values(bindings)) as (input:unknown)=>Promise<string|null>;
 const input=(signal=new AbortController().signal,voice='marie')=>({userId:'owner',owner:1,source,voice,french,signal,current:()=>true});
 return {state,files,resets,cleanups,client,input};
}
test('the actual kept-audio client reuses a private exact voice/source cache and never posts learner-edited text',async()=>{
 const h=setup(),first=await h.client(h.input());assert.ok(first);assert.equal(await h.client(h.input()),first);assert.equal(h.state.generation,1);assert.equal(h.files.size,1);await h.client(h.input(undefined,'sarah'));assert.equal(h.state.generation,2);assert.equal(h.files.size,2);assert.ok([...h.files.values()].every(row=>/^[0-9a-f]{64}$/.test(row.key)));await Promise.all(h.cleanups.map(fn=>fn()));assert.equal(h.files.size,0);
});
test('cancelled kept-audio authentication cannot begin a late manifest or paid generation',async()=>{
 const h=setup();let release!:()=>void,entered!:()=>void;const held=new Promise<void>(resolve=>{release=resolve;}),ready=new Promise<void>(resolve=>{entered=resolve;});h.state.headers=async()=>{entered();await held;return {authorization:'Bearer fake'};};const stop=new AbortController(),pending=h.client(h.input(stop.signal));await ready;stop.abort();assert.equal(await pending,null);release();for(let i=0;i<8;i++)await Promise.resolve();assert.deepEqual(h.state.calls,[]);assert.equal(h.files.size,0);
});
test('an account reset during a held final session check cannot dispatch a kept-audio request',async()=>{
 const h=setup();let calls=0,release!:(value:{id:string})=>void,entered!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;});h.state.session=async()=>{if(++calls===1)return {id:'owner'};entered();return new Promise(resolve=>{release=resolve;});};const pending=h.client(h.input());await ready;h.state.owner++;h.resets.forEach(fn=>fn());assert.equal(await pending,null);release({id:'owner'});for(let i=0;i<8;i++)await Promise.resolve();assert.deepEqual(h.state.calls,[]);
});
test('a changed canonical French manifest permits neither cached playback nor synthesis',async()=>{
 const h=setup();h.state.manifestFrench='Un cafe, merci.';assert.equal(await h.client(h.input()),null);assert.equal(h.state.generation,0);assert.equal(h.files.size,0);assert.equal(h.state.calls.length,1);
});
test('auth changes before scope updates cannot return cached or newly generated tutor audio',async()=>{
 const cached=setup();assert.ok(await cached.client(cached.input()));cached.state.onCacheRead=()=>{cached.state.session=async()=>({id:'next-owner'});};assert.equal(await cached.client(cached.input()),null);assert.equal(cached.state.generation,1,'no paid call from the cache race');assert.equal(cached.state.owner,1);
 for(const seam of ['onBody','onCommit']as const){const h=setup();h.state[seam]=()=>{h.state.session=async()=>({id:'next-owner'});};assert.equal(await h.client(h.input()),null);assert.equal(h.state.owner,1);assert.equal(h.files.size,0,'late generated bytes cannot remain committed');}
});
