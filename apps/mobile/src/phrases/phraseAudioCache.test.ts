import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createPhraseAudioCache,type PhraseAudioFiles } from './phraseAudioCache.ts';
function wav(){const b=new Uint8Array(48),v=new DataView(b.buffer);for(const [at,s]of [[0,'RIFF'],[8,'WAVEfmt '],[36,'data']]as const)for(let i=0;i<s.length;i++)b[at+i]=s.charCodeAt(i);v.setUint32(4,40,true);v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,22050,true);v.setUint32(28,44100,true);v.setUint16(32,2,true);v.setUint16(34,16,true);v.setUint32(40,4,true);return b;}
function ports(){const map=new Map<string,{key:string;uri:string;bytes:number;usedAt:number}>();let now=0;const files:PhraseAudioFiles={entries:async()=>[...map.values()].filter(row=>row.key!==''),temporary:async bytes=>{const uri=`private-${++now}`;map.set(uri,{key:'',uri,bytes:bytes.length,usedAt:now});return uri;},commit:async(uri,key)=>{map.get(uri)!.key=key;return uri;},touch:async key=>{for(const row of map.values())if(row.key===key)row.usedAt=++now;},remove:async uri=>{map.delete(uri);},clear:async()=>{map.clear();}};return {map,files};}
test('private phrase audio cache reuses an exact key and evicts the least recently heard line within byte and entry limits',async()=>{
 const p=ports(),cache=createPhraseAudioCache(p.files,2,96);const a='a'.repeat(64),b='b'.repeat(64),c='c'.repeat(64);
 const first=await cache.put(a,wav(),()=>true);assert.equal(await cache.read(a,()=>true),first);await cache.put(b,wav(),()=>true);await cache.read(a,()=>true);await cache.put(c,wav(),()=>true);
 assert.equal(await cache.read(b,()=>true),null);assert.ok(await cache.read(a,()=>true));assert.ok(await cache.read(c,()=>true));assert.equal(p.map.size,2);await cache.reset();assert.equal(p.map.size,0);
});
test('reset during a held private audio write fences the commit and awaits deletion of every temporary byte',async()=>{
 const p=ports();let entered!:()=>void,release!:()=>void;const ready=new Promise<void>(resolve=>{entered=resolve;}),held=new Promise<void>(resolve=>{release=resolve;});const write=p.files.temporary;
 p.files.temporary=async bytes=>{const uri=await write(bytes);entered();await held;return uri;};
 const cache=createPhraseAudioCache(p.files),pending=cache.put('a'.repeat(64),wav(),()=>true);await ready;const reset=cache.reset();release();assert.equal(await pending,null);await reset;assert.equal(p.map.size,0);assert.equal(await cache.read('a'.repeat(64),()=>true),null);
});
test('private audio refuses arbitrary filenames, stale owner or voice, malformed WAV and oversized bytes',async()=>{
 const p=ports(),cache=createPhraseAudioCache(p.files);for(const [key,bytes,current]of [['sentence.wav',wav(),true],['a'.repeat(64),wav(),false],['a'.repeat(64),new Uint8Array(48),true],['a'.repeat(64),new Uint8Array(882046),true]]as const)assert.equal(await cache.put(key,bytes,()=>current),null);assert.equal(p.map.size,0);
 let current=true;const commit=p.files.commit;p.files.commit=async(uri,key)=>{const result=await commit(uri,key);current=false;return result;};assert.equal(await cache.put('a'.repeat(64),wav(),()=>current),null);assert.equal(p.map.size,0);
});
