import assert from 'node:assert/strict';
import { test } from 'node:test';
import { buildConversationPack, DEFAULT_TUTOR_VOICE, firstPracticeScenario } from '@luvani/core';
import { briefFromDraft, firstAchievements, firstLiveSummary, repairFirstLiveRecord, type FirstLiveRecord } from './firstLiveModel.ts';
import { freshPreAccountDraft } from './preAccountDraft.ts';
import { readFileSync } from 'node:fs';
test('travel and café interests reach the live scenario without mutating the saved choices', () => {
  const draft = { ...freshPreAccountDraft(), reason: 'trip' as const, interests: ['food', 'music'] as ('food' | 'music')[],
    startLevel: 'few' as const, speakingConfidence: 'trying' as const, practiceFocus: 'speaking' as const, minutes: 10 as const, tutorVoice: 'emilie' as const };
  const brief = briefFromDraft(draft);
  assert.deepEqual(brief, { version: 1, goals: ['trip'], interests: ['food', 'music'], level: 'few', confidence: 'trying', focus: 'speaking', minutes: 10, tutorVoice: 'emilie' });
  assert.match(firstPracticeScenario(brief).brief, /restaurant during your trip/);
  brief.interests?.pop();
  assert.deepEqual(draft.interests, ['food', 'music']);
});
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
test('an English spoken help request cannot support a claim that French was spoken', () => {
  const mixed: FirstLiveRecord = { ...record, contributions: [...record.contributions, { id: 'help', text: 'Can you explain that in English?', input: 'spoken' }] };
  assert.match(firstAchievements(mixed).join(' '), /by typing/);
  assert.match(firstAchievements(mixed).join(' '), /using your voice/);
  assert.doesNotMatch(firstAchievements(mixed).join(' '), /spoke French|pronunciation|mastered/);
  const celebration = readFileSync(new URL('./FirstSessionResult.tsx', import.meta.url), 'utf8');
  assert.match(celebration, />You practised French\./);
  assert.doesNotMatch(celebration, /You spoke French\./, 'capture mode alone cannot establish French speech');
});
test('record repair requires completion proof and rejects duplicate final turns or cross-session packs', () => {
  assert.ok(repairFirstLiveRecord(record));
  for (const patch of [{pack:null},{completedAt:null},{contributions:[record.contributions[0],record.contributions[0]]},{pack:{...record.pack,sessionId:'another'}},{seconds:1261}])
    assert.equal(repairFirstLiveRecord({...record,...patch}),null);
});
