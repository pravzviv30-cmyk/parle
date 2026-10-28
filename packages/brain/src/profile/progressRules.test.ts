import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  IMPROVING_AFTER_SESSIONS,
  MAX_PATTERN_EXAMPLE,
  applyTurnToProfile,
  createProfile,
  finishSession,
  improvingPatterns,
  repairProfile,
  type LearnerProfile,
} from './profile.ts';
import { mergeLearnerProfiles } from './merge.ts';
import { createConversation, integrateTurn } from '../engine/conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { sampleCoachItem, sampleTurn } from '../contract/samples.ts';

const NOW = '2026-10-28T10:00:00.000Z';

function ended() {
  return createConversation(
    CAFE_FRAME,
    { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0, name: null },
    { strictness: 'balanced', maxTurns: 24 },
    1_000,
  );
}

function sighting(tag: string, example = 'x') {
  return sampleTurn({ profileSignals: { errorPatterns: [{ tag, example }], usedWell: [] } });
}

/** One live session: optionally a sighting of `tag`, then finishSession. */
function session(profile: LearnerProfile, tag: string | null): LearnerProfile {
  const during = tag === null ? applyTurnToProfile(profile, sampleTurn(), NOW) : applyTurnToProfile(profile, sighting(tag), NOW);
  return finishSession(during, ended());
}

describe('improvingPatterns (LEARN-011)', () => {
  test(`a recurring pattern qualifies after exactly ${IMPROVING_AFTER_SESSIONS} clean sessions`, () => {
    let p = createProfile();
    p = session(p, 'liaison');
    p = session(p, 'liaison'); // recurring now, last seen in ordinal 1
    assert.deepEqual(improvingPatterns(p), []);
    p = session(p, null);
    p = session(p, null);
    assert.deepEqual(improvingPatterns(p), [], 'two clean sessions are not enough');
    p = session(p, null);
    assert.deepEqual(improvingPatterns(p), [{ tag: 'liaison', lastSession: 1 }]);
    p = session(p, 'liaison');
    assert.deepEqual(improvingPatterns(p), [], 'seen again, no longer improving');
  });

  test('a suspected pattern never qualifies, however quiet', () => {
    let p = session(createProfile(), 'genre');
    for (let i = 0; i < 6; i += 1) p = session(p, null);
    assert.deepEqual(improvingPatterns(p), []);
  });

  test('legacy patterns repaired to sessions 1 never qualify', () => {
    const stored = applyTurnToProfile(createProfile(), sighting('liaison'), NOW);
    stored.stats.sessions = 20;
    const legacy = JSON.parse(JSON.stringify(stored)) as Record<string, any>;
    delete legacy.errorPatterns.liaison.sessions;
    legacy.errorPatterns.liaison.lastSession = 0;
    const repaired = repairProfile(legacy);
    assert.deepEqual(improvingPatterns(repaired), []);
  });

  test('orders by most recent lastSession, ties by tag, and never exposes counts', () => {
    const base = createProfile();
    const pat = (lastSession: number) => ({ count: 9, lastSeen: NOW, example: 'x', sessions: 3, lastSession });
    const p = { ...base, stats: { ...base.stats, sessions: 10 }, errorPatterns: { b: pat(5), a: pat(5), c: pat(2), d: pat(7) } };
    const out = improvingPatterns(p);
    assert.deepEqual(out, [
      { tag: 'a', lastSession: 5 },
      { tag: 'b', lastSession: 5 },
      { tag: 'c', lastSession: 2 },
    ]);
    assert.ok(out.every((e) => !('count' in e) && !('sessions' in e)));
  });
});

describe('session-wide credit (LEARN-012)', () => {
  const taught = sampleTurn({
    newPhrases: [{ fr: 'Je ne sais pas', frWritten: null, en: "I don't know", enLiteral: null, register: 'courant', note: null }],
  });
  const coached = sampleTurn({ coach: [sampleCoachItem({ quote: 'Je ne sais pas' })] });
  const claims = sampleTurn({ coach: [], profileSignals: { errorPatterns: [], usedWell: ['Je ne sais pas'] } });

  test('a form corrected earlier earns no profile credit later, matching the end card', () => {
    let state = ended();
    let profile = applyTurnToProfile(createProfile(), taught, NOW);
    for (const turn of [coached, claims]) {
      const correctedEarlier = state.correctedForms;
      state = integrateTurn(state, { type: 'spoke', text: 'je ne sais pas' }, turn).state;
      profile = applyTurnToProfile(profile, turn, NOW, { correctedEarlier });
    }
    assert.equal(profile.phrases['je ne sais pas']!.timesUsedWell, 0);
    assert.equal(profile.phrases['je ne sais pas']!.timesAssisted, 0);
  });

  test('assisted uses of a corrected form are not recorded either', () => {
    const profile = applyTurnToProfile(applyTurnToProfile(createProfile(), taught, NOW), claims, NOW, {
      assisted: true,
      correctedEarlier: ["Je NE sais pas"],
    });
    assert.equal(profile.phrases['je ne sais pas']!.timesAssisted, 0);
  });

  test('without correctedEarlier the use still counts (no session-wide rule assumed)', () => {
    const profile = applyTurnToProfile(applyTurnToProfile(createProfile(), taught, NOW), claims, NOW);
    assert.equal(profile.phrases['je ne sais pas']!.timesUsedWell, 1);
  });
});

describe(`pattern example clamp (${MAX_PATTERN_EXAMPLE})`, () => {
  const long = '😀'.repeat(MAX_PATTERN_EXAMPLE + 40);

  test('clamped when written, by code point, without splitting a surrogate pair', () => {
    const p = applyTurnToProfile(createProfile(), sighting('liaison', long), NOW);
    const ex = p.errorPatterns.liaison!.example;
    assert.equal(Array.from(ex).length, MAX_PATTERN_EXAMPLE);
    assert.equal(ex, '😀'.repeat(MAX_PATTERN_EXAMPLE));
  });

  test('clamped on read for stored profiles, and through a merge', () => {
    const stored = applyTurnToProfile(createProfile(), sighting('liaison'), NOW) as any;
    stored.errorPatterns.liaison.example = 'a'.repeat(1000);
    assert.equal(repairProfile(stored).errorPatterns.liaison!.example.length, MAX_PATTERN_EXAMPLE);
    const merged = mergeLearnerProfiles(stored, createProfile(), 0, 0);
    assert.equal(merged.errorPatterns.liaison!.example.length, MAX_PATTERN_EXAMPLE);
  });

  test('short examples are untouched', () => {
    const p = applyTurnToProfile(createProfile(), sighting('liaison', 'je ne sais'), NOW);
    assert.equal(p.errorPatterns.liaison!.example, 'je ne sais');
  });
});
