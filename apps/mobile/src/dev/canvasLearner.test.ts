/**
 * The canvas learner, held to what makes it safe: refused unless every lock
 * holds, seeds through the stores, idempotent, and bound to one account.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { evidenceOf, localDayKey, phraseKeyOf } from '@luvani/core';

import { setActiveUser } from '../storage/scope.ts';
import { loadConversationPacks } from '../conversationPacks/store.ts';
import { SAMPLE_LABEL, SAMPLE_PACK_ID } from '../conversationPacks/sampleFixture.ts';
import { loadDeck } from '../review/store.ts';
import { loadMissionCompletions } from '../missions/store.ts';
import { loadActivity, earnedXp } from '../progress/activity.ts';
import { loadGame } from '../game/store.ts';
import { loadProfile } from '../profile/store.ts';
import { CANVAS_REVISIT_PACK_ID, CANVAS_XP, canvasAllowed, canvasStartsFresh, seedCanvasLearner } from './canvasLearner.ts';

const ON = { NODE_ENV: 'development', EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1', EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: '1' };
const NOW = new Date(2026, 9, 20, 15, 0, 0).getTime();

const disk = new Map<string, string>();
let onWrite: ((key: string) => void) | null = null;
const shared = AsyncStorage as unknown as Record<string, unknown>;
shared.getItem = (key: string) => Promise.resolve(disk.get(key) ?? null);
shared.setItem = (key: string, value: string) => {
  disk.set(key, value);
  onWrite?.(key);
  return Promise.resolve();
};
shared.removeItem = (key: string) => {
  disk.delete(key);
  return Promise.resolve();
};

let n = 0;
const nextUid = () => `66666666-6666-4666-8666-${String(++n).padStart(12, '0')}`;
const keysOf = (uid: string) => [...disk.keys()].filter((k) => k.includes(uid));

describe('the canvas learner', () => {
  test('is refused in production, without either flag, and on a real adapter', async () => {
    assert.equal(canvasAllowed({ kind: 'mock' }, ON), true);
    assert.equal(canvasAllowed({ kind: 'mock' }, { ...ON, NODE_ENV: 'production' }), false);
    assert.equal(canvasAllowed({ kind: 'mock' }, { ...ON, EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: undefined }), false);
    assert.equal(canvasAllowed({ kind: 'mock' }, { ...ON, EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: undefined }), false);
    assert.equal(canvasAllowed({ kind: 'supabase' }, ON), false);
    for (const [adapter, env] of [
      [{ kind: 'supabase' as const }, ON],
      [{ kind: 'mock' as const }, { ...ON, NODE_ENV: 'production' }],
      [{ kind: 'mock' as const }, { ...ON, EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: '0' }],
    ] as const) {
      const uid = nextUid();
      setActiveUser(uid);
      assert.deepEqual(await seedCanvasLearner({ id: uid }, adapter, NOW, env), { ok: false, reason: 'not-allowed' });
      assert.equal(keysOf(uid).length, 0, 'a refused seed still wrote');
    }
  });

  test('seeds Yasmin: day 3, level 2 XP, 6 of 10 minutes, second café scene next', async () => {
    const uid = nextUid();
    setActiveUser(uid);
    assert.deepEqual(await seedCanvasLearner({ id: uid }, { kind: 'mock' }, NOW, ON), { ok: true });

    const profile = (await loadProfile())!;
    assert.equal(profile.name, 'Yasmin');
    assert.equal(profile.dailyGoalMin, 10);
    const kinds = profile.brain.memory.facts.map((f) => f.kind);
    assert.ok(kinds.includes('interest') && kinds.includes('life-event'));
    assert.equal(profile.brain.memory.facts.find((f) => f.kind === 'life-event')?.happensAround, 'Friday');
    assert.ok(profile.brain.errorPatterns['gender-agreement']!.count >= 2);

    const packs = await loadConversationPacks();
    const revisit = packs.find((p) => p.id === CANVAS_REVISIT_PACK_ID)!;
    assert.ok(packs.some((p) => p.id === SAMPLE_PACK_ID));
    assert.equal(revisit.revisedFromPackId, SAMPLE_PACK_ID);
    for (const p of packs) assert.ok(p.title.en.includes(SAMPLE_LABEL), 'a seeded pack is not labelled');
    assert.ok(revisit.corrections.length > 0);

    const deck = await loadDeck();
    assert.ok(deck.some((c) => c.due <= NOW || c.due <= Date.now()), 'nothing is due');
    assert.equal(evidenceOf(deck.find((c) => c.id === phraseKeyOf('Je voudrais un café.'))!).convoUses, 2);
    assert.equal(evidenceOf(deck.find((c) => c.id === phraseKeyOf('Sur place, merci.'))!).retrievals, 1);

    const done = await loadMissionCompletions();
    assert.deepEqual(done.filter((c) => c.id === 'mission:premier-cafe').map((c) => c.rung), [1, 4]);
    assert.deepEqual(done.filter((c) => c.id === 'mission:cafe').map((c) => c.rung), [2]);

    const activity = await loadActivity();
    assert.equal(new Set(activity.map((e) => localDayKey(e.at))).size, 3, 'not three days');
    const today = localDayKey(NOW);
    assert.equal(activity.filter((e) => localDayKey(e.at) === today).reduce((s, e) => s + (e.activeMs ?? 0), 0), 6 * 60 * 1000);
    const game = await loadGame();
    assert.equal(game.claims.filter((c) => c.day === today).length, 1);
    assert.equal(game.questDays.find((d) => d.day === today)?.ids.length, 3);
    assert.equal((await earnedXp()) + game.claims.reduce((s, c) => s + c.xp, 0), CANVAS_XP);
  });

  test('a second run changes nothing, and real records are kept', async () => {
    const uid = nextUid();
    setActiveUser(uid);
    await seedCanvasLearner({ id: uid }, { kind: 'mock' }, NOW, ON);
    const before = new Map(keysOf(uid).map((k) => [k, disk.get(k)]));
    await seedCanvasLearner({ id: uid }, { kind: 'mock' }, NOW + 60_000, ON);
    for (const [k, v] of before) {
      if (k.endsWith('.deck') || k.includes('dirty') || k.includes('sync')) continue;
      assert.equal(disk.get(k), v, `${k} changed on the second run`);
    }
    assert.equal((await loadActivity()).length, 3);
  });

  test('stops when the account changes mid-seed and never writes the other account', async () => {
    const uid = nextUid();
    const other = nextUid();
    setActiveUser(uid);
    let writes = 0;
    onWrite = () => {
      if (++writes === 1) setActiveUser(other);
    };
    try {
      assert.deepEqual(await seedCanvasLearner({ id: uid }, { kind: 'mock' }, NOW, ON), { ok: false, reason: 'account-changed' });
    } finally {
      onWrite = null;
    }
    assert.equal(keysOf(other).length, 0, 'the seed wrote into the account that signed in');
  });
});

describe('the canvas learner fresh start', () => {
  test('fresh is allowed under the same locks, and only fresh clears first', () => {
    const dev = { NODE_ENV: 'development', EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1' };
    assert.equal(canvasAllowed({ kind: 'mock' }, { ...dev, EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: 'fresh' }), true);
    assert.equal(canvasAllowed({ kind: 'supabase' } as never, { ...dev, EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: 'fresh' }), false);
    assert.equal(canvasAllowed({ kind: 'mock' }, { NODE_ENV: 'production', EXPO_PUBLIC_LUVANI_LOCAL_DEVELOPMENT: '1', EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: 'fresh' }), false);
    assert.equal(canvasStartsFresh({ EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: 'fresh' }), true);
    assert.equal(canvasStartsFresh({ EXPO_PUBLIC_LUVANI_CANVAS_LEARNER: '1' }), false);
  });
});
