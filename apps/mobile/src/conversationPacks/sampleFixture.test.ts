/**
 * The development sample, held to the three things that make it safe: it is
 * refused on anything but a local mock build, it never overwrites what an
 * account already has, and it writes nothing that reads as the learner's work.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { buildConversationPack, phraseKeyOf, selectPackQueue, type ConversationPack } from '@luvani/core';

import { setActiveUser } from '../storage/scope.ts';
import { loadConversationPacks } from './store.ts';
import { loadDeck } from '../review/store.ts';
import { loadDrillBank } from '../drill/store.ts';
import {
  SAMPLE_LABEL,
  SAMPLE_PACK_ID,
  isSamplePack,
  loadSampleConversation,
  sampleAllowed,
  sampleExercises,
  samplePackFor,
  withSample,
} from './sampleFixture.ts';
import { practicePackOf } from '../practice/recommendation.ts';

const LOCAL = { NODE_ENV: 'development', EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1' };
const NOW = Date.UTC(2026, 8, 24, 12);

const disk = new Map<string, string>();
const shared = AsyncStorage as unknown as Record<string, unknown>;
shared.getItem = (key: string) => Promise.resolve(disk.get(key) ?? null);
shared.setItem = (key: string, value: string) => {
  disk.set(key, value);
  return Promise.resolve();
};
shared.removeItem = (key: string) => {
  disk.delete(key);
  return Promise.resolve();
};

let n = 0;
const nextUid = () => `55555555-5555-4555-8555-${String(++n).padStart(12, '0')}`;

describe('the development sample conversation', () => {
  test('is offered only on a local mock build, whatever the flags say', () => {
    assert.equal(sampleAllowed({ kind: 'mock' }, LOCAL), true);
    // The lead's point: local flags with Supabase configured sign in for real.
    assert.equal(sampleAllowed({ kind: 'supabase' }, LOCAL), false, 'a real account could be seeded with a sample');
    assert.equal(sampleAllowed({ kind: 'mock' }, { ...LOCAL, NODE_ENV: 'production' }), false);
    assert.equal(sampleAllowed({ kind: 'mock' }, { NODE_ENV: 'development' }), false, 'the local switch is not required');
  });

  test('refuses before writing anything when not allowed', async () => {
    const uid = nextUid();
    setActiveUser(uid);
    const before = disk.size;
    assert.deepEqual(await loadSampleConversation({ id: uid }, { kind: 'supabase' }, NOW, LOCAL), { ok: false, reason: 'not-allowed' });
    assert.equal(disk.size, before, 'a refused load still wrote to the phone');
  });

  test('is labelled, owned by the account that asked, and offers playable practice', async () => {
    const uid = nextUid();
    setActiveUser(uid);
    const result = await loadSampleConversation({ id: uid }, { kind: 'mock' }, NOW, LOCAL);
    assert.deepEqual(result, { ok: true, added: true });

    const packs = await loadConversationPacks();
    const sample = packs.find(isSamplePack)!;
    assert.ok(sample, 'the sample did not land in the pack cache');
    assert.equal(sample.learnerId, uid, 'the sample belongs to somebody else');
    assert.ok(sample.title.en.includes(SAMPLE_LABEL) && sample.summary.includes(SAMPLE_LABEL), 'the sample is not labelled where it shows');

    // Practise this conversation finds real work, even though nothing is due.
    const deck = await loadDeck();
    const bank = await loadDrillBank();
    const queue = selectPackQueue(practicePackOf(sample), deck, bank, NOW);
    assert.ok(queue.targets.length >= 4, `the sample offers only ${queue.targets.length} playable targets`);
    assert.ok(bank.some((e) => e.kind === 'translate' && e.direction === 'en-fr'), 'the sample offers no recall format');
    assert.ok(deck.every((card) => card.reps === 0 && card.lapses === 0), 'the sample wrote grades, which are claims about the learner');
  });

  test('never overwrites: an existing pack with the id, and every other pack, is kept as it is', async () => {
    const uid = nextUid();
    setActiveUser(uid);
    const theirs = buildConversationPack({
      id: 'their-own', sessionId: 'their-own', learnerId: uid, createdAt: new Date(NOW - 86_400_000).toISOString(),
      title: { fr: 'Le leur', en: 'Their own' }, summary: 'Real.', keyPhrases: [{ fr: 'Bonjour', frWritten: null, en: 'hello' }],
    });
    const squatter: ConversationPack = { ...samplePackFor(uid, new Date(NOW).toISOString()), summary: 'already here' };

    assert.deepEqual(withSample([theirs], samplePackFor(uid, 'x')).map((p) => p.id), [SAMPLE_PACK_ID, 'their-own']);
    assert.equal(withSample([squatter, theirs], samplePackFor(uid, 'x')).find(isSamplePack)!.summary, 'already here', 'an existing pack was replaced');

    await loadSampleConversation({ id: uid }, { kind: 'mock' }, NOW, LOCAL);
    const again = await loadSampleConversation({ id: uid }, { kind: 'mock' }, NOW + 1, LOCAL);
    assert.deepEqual(again, { ok: true, added: false }, 'a second load added a second sample');
    assert.equal((await loadConversationPacks()).filter(isSamplePack).length, 1);
  });

  test('stops when the account changes before it writes', async () => {
    const asked = nextUid();
    setActiveUser(nextUid());
    assert.deepEqual(await loadSampleConversation({ id: asked }, { kind: 'mock' }, NOW, LOCAL), { ok: false, reason: 'account-changed' });
  });

  test('its exercises are keyed to the deck and it writes no history, resume or activity', () => {
    const sample = samplePackFor('learner', new Date(NOW).toISOString());
    for (const exercise of sampleExercises(sample)) {
      assert.ok(practicePackOf(sample).phraseKeys.includes(exercise.phraseKey), `${exercise.id} is keyed to no phrase in the sample`);
    }
    assert.ok(practicePackOf(sample).phraseKeys.includes(phraseKeyOf("J'ai faim.")), 'the correction does not reach practice');
    const source = readFileSync(fileURLToPath(new URL('./sampleFixture.ts', import.meta.url)), 'utf8');
    for (const forbidden of ['recordActivity', 'gradeCards', 'markPackPractised', 'history', 'resume']) {
      const code = source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
      assert.ok(!code.includes(forbidden), `the sample reaches for ${forbidden}, which would make it a claim about the learner`);
    }
  });
});
