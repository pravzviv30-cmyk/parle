import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import ts from 'typescript';
function compiled(file:string) {
  return ts.transpileModule(readFileSync(new URL(file,import.meta.url),'utf8').replace(/^import .*;\n/gm,''),
    {compilerOptions:{target:ts.ScriptTarget.ES2022,module:ts.ModuleKind.ES2022,jsx:ts.JsxEmit.React}}).outputText.replace(/\bexport /g,'');
}
function storage() {
  let owner=1;const disk=new Map<string,string>();let fail=false,wait:(()=>Promise<void>)|undefined;
  const names={AsyncStorage:{getItem:async(key:string)=>{const value=disk.get(key)??null;await wait?.();return value;}},scopeGeneration:()=>owner,userKey:(key:string)=>`${owner}:${key}`,
    setItemInUserScope:async(generation:number,key:string,value:string)=>{if(fail || generation!==owner)throw new Error('unavailable');disk.set(key,value);}};
  const api=new Function(...Object.keys(names),compiled('./arrival.ts')+'; return {loadArrival,saveArrival};')(...Object.values(names)) as {loadArrival:()=>Promise<unknown>;saveArrival:(v:unknown)=>Promise<void>};
  return {api,disk,fail:()=>{fail=true;},change:()=>{owner++;},wait:(fn:()=>Promise<void>)=>{wait=fn;}};
}
const receipt={sessionId:'first-session',finishedAt:[12345],welcomeSeen:false,streakSeen:false};
test('arrival receipts survive reopening without repeating a welcome or awarding any new practice',async()=>{
  const h=storage();await h.api.saveArrival(receipt);assert.deepEqual(await h.api.loadArrival(),receipt);
  await h.api.saveArrival({...receipt,welcomeSeen:true,streakSeen:true});
  assert.deepEqual(await h.api.loadArrival(),{...receipt,welcomeSeen:true,streakSeen:true});assert.equal(h.disk.size,1);
});
test('a failed receipt write is retryable and an account change cannot read the earlier owner receipt',async()=>{
  const h=storage();await h.api.saveArrival(receipt);h.fail();await assert.rejects(h.api.saveArrival({...receipt,welcomeSeen:true}));
  assert.deepEqual(await h.api.loadArrival(),receipt);
  h.wait(async()=>h.change());await assert.rejects(h.api.loadArrival());
});
test('Home waits 1500 ms after readiness, skips welcome/other tabs, and persists once before displaying',async()=>{
  for(const ready of [false,true])for(const allowed of [false,true])for(const focused of [false,true]) {
    const timers:{fn:()=>void;ms:number}[]=[],events:string[]=[];let effect:(()=>void)|undefined;
    const names={createContext:(v:unknown)=>v,useContext:()=>allowed,useIsFocused:()=>focused,useRef:(v:unknown)=>({current:v}),useState:(v:unknown)=>[v,()=>events.push('display')],useEffect:(fn:()=>void)=>{effect=fn;},
      AppState:{currentState:'active',addEventListener:()=>({remove:()=>{}})},scopeGeneration:()=>1,setTimeout:(fn:()=>void,ms:number)=>{timers.push({fn,ms});return 1;},clearTimeout:()=>{},
      loadArrival:async()=>({...receipt,welcomeSeen:true}),saveArrival:async(v:typeof receipt)=>{assert.equal(v.streakSeen,true);events.push('saved');}};
    const run=new Function(...Object.keys(names),compiled('./HomeArrival.tsx')+';return HomeArrival;')(...Object.values(names));run({ready});effect?.();
    assert.equal(timers.length,ready&&allowed&&focused?1:0);
    if(timers[0]){assert.equal(timers[0].ms,1500);assert.deepEqual(events,[]);timers[0].fn();await Promise.resolve();await Promise.resolve();await Promise.resolve();assert.deepEqual(events,['saved','display']);}
  }
});
