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
  const jobs: PracticeJobs={receive:async()=>{},claim:async()=>job,finish:async(_job,ex)=>{finishes.push(ex);return true;}};
  const unavailable={drills:async()=>{throw new Error('sensitive provider detail');}};
  assert.equal(await processPracticeJob({...jobs,claim:async()=>null},unavailable),'idle');
  assert.equal(await processPracticeJob(jobs,unavailable),'retry');
  assert.deepEqual(finishes,[null]);
  assert.equal(await processPracticeJob({...jobs,claim:async()=>({...job,payload:{...pack,keyPhrases:[]}})},unavailable),'complete');
  assert.deepEqual(finishes,[null,[]]);
});

test('an uncertain completion is not followed by a conflicting failure acknowledgement', async () => {
  let calls=0;
  const jobs: PracticeJobs={receive:async()=>{},claim:async()=>({...job,payload:{...pack,keyPhrases:[]}}),finish:async()=>{calls++;throw new Error('timeout');}};
  await assert.rejects(processPracticeJob(jobs,{drills:async()=>{throw new Error('unused');}}),/timeout/);
  assert.equal(calls,1);
});

test('a deleted or superseded job is never recreated by a worker', async () => {
  const jobs: PracticeJobs={receive:async()=>{throw new Error('must not recreate');},claim:async()=>({...job,payload:{...pack,keyPhrases:[]}}),finish:async()=>false};
  assert.equal(await processPracticeJob(jobs,{drills:async()=>{throw new Error('unused');}}),'superseded');
});
