import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack, DEFAULT_TUTOR_VOICE } from '@luvani/core';
import { firstAchievements, firstLiveSummary, repairFirstLiveRecord, type FirstLiveRecord } from './firstLiveModel.ts';
const id = '11111111-1111-4111-8111-111111111111';
const record: FirstLiveRecord = { brief: {version:1,goals:['food'],level:'zero',confidence:'hesitant',focus:'words',minutes:20,tutorVoice:DEFAULT_TUTOR_VOICE},
  sessionId:id,outcome:'completed',contributions:[{id:'u1',text:'Une table pour deux, merci.',input:'typed'}],seconds:60,completedAt:Date.now(),
  pack:buildConversationPack({id,sessionId:id,learnerId:'guest',createdAt:new Date().toISOString(),title:{fr:'Au restaurant',en:'At a restaurant'},summary:'A restaurant conversation.',
    keyPhrases:[{fr:'Une table pour deux',frWritten:null,en:'A table for two'},{fr:'La carte',frWritten:null,en:'The menu'}]}) };
test('achievements use confirmed learner phrases, never tutor-only vocabulary or a spoken claim for typing', () => {
  const text = firstAchievements(record).join(' '); assert.match(text,/You said “Une table pour deux” by typing/);
  assert.doesNotMatch(text,/La carte|spoke|pronunciation|mastered|confiden/); assert.match(firstLiveSummary(record).next,/20 minutes/);
});
test('spoken recognition is not quoted as certain; partial and interrupted sessions never claim completion', () => {
  for (const outcome of ['partial','interrupted'] as const) {
    const r = {...record,outcome,contributions:[{id:'u1',text:'La carte',input:'spoken' as const}]};
    assert.doesNotMatch(firstLiveSummary(r).heading,/completed/); assert.doesNotMatch(firstAchievements(r).join(' '),/completed|La carte/);
    assert.match(firstAchievements(r).join(' '),/using your voice/);
  }
  assert.match(firstLiveSummary({...record,outcome:'interrupted'}).detail,/connection/);
});
test('a session without confirmed contributions has no invented vocabulary achievements', () => {
  assert.deepEqual(firstAchievements({...record,outcome:'partial',contributions:[]}),[]);
});
test('record repair requires completion proof and rejects duplicate final turns or cross-session packs', () => {
  assert.ok(repairFirstLiveRecord(record));
  for (const patch of [{pack:null},{completedAt:null},{contributions:[record.contributions[0],record.contributions[0]]},{pack:{...record.pack,sessionId:'another'}},{seconds:1261}])
    assert.equal(repairFirstLiveRecord({...record,...patch}),null);
});
