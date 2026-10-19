/**
 * The profile merge, and the property that lets the sync engine skip an
 * operation log.
 *
 * `upgrade` is injected here because the brain must not import the app, so
 * these tests supply a stand-in that mirrors the v6 branch of
 * `apps/mobile/src/profile/upgrade.ts`. What that pins is the *contract*: the
 * merge calls the version chain on every side and on its own result, and never
 * carries a field the chain would have refused. Wiring the real
 * `upgradeStored` in is `apps/mobile/src/sync/policy.test.ts`, which owns that
 * seam.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { DEFAULT_TUTOR_VOICE, isTutorVoiceKey } from '@luvani/core';

import {
  mergeLearnerProfiles,
  mergeStoredProfiles,
  PROFILE_ANSWER_FIELDS,
  PROFILE_UNION_FIELDS,
  type MergedStoredProfile,
  type ProfileMergeDeps,
} from './merge.ts';
import {
  createProfile,
  MASTERY_USES,
  MAX_ERROR_PATTERNS,
  MAX_PHRASES,
  type LearnerProfile,
} from './profile.ts';

const NOW = 1_700_000_000_000;
const GOALS: ReadonlySet<unknown> = new Set([5, 10, 15]);

/**
 * The v8 branch of the app's version chain, in the shape the merge is handed.
 *
 * This stand-in moves when the app's chain moves, and it has to: the merge runs
 * the chain on its own result, so one stuck a version behind would strip the
 * field the merge had just decided and let a test pass that proves nothing.
 *
 * `tutorVoice` is trusted only from a v6 blob, exactly as `upgrade.ts` does it.
 * Every earlier version predates the voice question, so whatever sits in that
 * slot on an older disk is not an answer the learner ever gave.
 *
 * `ageStopAt` is deliberately absent. It is a device field the merge drops
 * before the chain ever sees it, and `apps/mobile/src/profile/ageStop.test.ts`
 * owns that seam against the real chain rather than against a stand-in.
 */
function chain(stored: unknown, now: number): Record<string, unknown> | null {
  if (typeof stored !== 'object' || stored === null || Array.isArray(stored)) return null;
  const r = stored as Record<string, unknown>;
  const version = r.version;
  if (version !== 1 && version !== 2 && version !== 3 && version !== 4 && version !== 5 && version !== 6 && version !== 7 && version !== 8) return null;
  const strings = (value: unknown, cap: number): string[] =>
    Array.isArray(value) ? [...new Set(value.filter((v): v is string => typeof v === 'string' && v.length > 0))].slice(-cap) : [];
  return {
    version: 8,
    name: typeof r.name === 'string' ? r.name : null,
    dob: typeof r.dob === 'string' ? r.dob : null,
    ageConfirmed: r.ageConfirmed === true ? true : null,
    motivation: typeof r.motivation === 'string' ? r.motivation : null,
    dailyGoalMin: GOALS.has(r.dailyGoalMin) ? r.dailyGoalMin : null,
    tutorVoice: (version === 6 || version === 7 || version === 8) && isTutorVoiceKey(r.tutorVoice) ? r.tutorVoice : null,
    preferTyping: (version === 7 || version === 8) && r.preferTyping === true,
    // v8's two lists, read only from a v8 blob's own slot, as upgrade.ts does.
    forgottenFacts: version === 8 ? strings(r.forgottenFacts, Number.MAX_SAFE_INTEGER) : [],
    learnerGoals: version === 8 ? strings(r.learnerGoals, 3) : [],
    onboardedAt: typeof r.onboardedAt === 'number' ? r.onboardedAt : now,
    username: typeof r.username === 'string' ? r.username : null,
    // Each sub-answer survives on its own closed set, exactly as upgrade.ts's
    // storedPracticePreferences does, and the field is absent when none did.
    ...practice(r.practicePreferences),
    brain: r.brain,
  };
}

const LEVELS = ['zero', 'few', 'getby', 'confident'] as const;
const CONFIDENCES = ['hesitant', 'trying', 'comfortable'] as const;
const FOCUSES = ['listening', 'speaking', 'words'] as const;

function practice(value: unknown): { practicePreferences?: Record<string, unknown> } {
  if (typeof value !== 'object' || value === null || Array.isArray(value)) return {};
  const v = value as Record<string, unknown>;
  const pick = (set: readonly string[], x: unknown) => (typeof x === 'string' && set.includes(x) ? x : null);
  const clean = { level: pick(LEVELS, v.level), confidence: pick(CONFIDENCES, v.confidence), focus: pick(FOCUSES, v.focus) };
  return clean.level === null && clean.confidence === null && clean.focus === null ? {} : { practicePreferences: clean };
}

let chainCalls = 0;
const deps: ProfileMergeDeps = {
  upgrade: (stored, now) => {
    chainCalls += 1;
    return chain(stored, now);
  },
  now: NOW,
};

type Phrase = LearnerProfile['phrases'][string];
type Pattern = LearnerProfile['errorPatterns'][string];

function phrase(fr: string, timesUsedWell: number, mastered: boolean, introducedAt = '2026-01-01T00:00:00.000Z'): Phrase {
  return { fr, frWritten: null, en: fr, register: 'courant', introducedAt, timesUsedWell, mastered };
}

function pattern(count: number, lastSeen: string, example = 'ex'): Pattern {
  return { count, lastSeen, example };
}

function brain(over: Partial<LearnerProfile> = {}): LearnerProfile {
  const base = createProfile();
  return { ...base, ...over, stats: { ...base.stats, ...(over.stats ?? {}) } };
}

function stored(over: Record<string, unknown> = {}): Record<string, unknown> {
  return {
    version: 8,
    name: null,
    dob: null,
    ageConfirmed: null,
    motivation: null,
    dailyGoalMin: null,
    // Never chosen, which is what the app writes for everybody until they pick
    // a voice. It is not the default: the default is the agent's to apply.
    tutorVoice: null,
    preferTyping: false,
    forgottenFacts: [],
    learnerGoals: [],
    onboardedAt: NOW,
    username: null,
    brain: createProfile(),
    ...over,
  };
}

function merge(a: unknown, b: unknown, aSavedAt = 1, bSavedAt = 2): MergedStoredProfile | null {
  return mergeStoredProfiles({ stored: a, savedAt: aSavedAt }, { stored: b, savedAt: bSavedAt }, deps);
}

const same = (a: unknown, b: unknown) => JSON.stringify(a) === JSON.stringify(b);

/** Deterministic PRNG — a property test that cannot be replayed is a rumour. */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1_664_525 + 1_013_904_223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const ISO = ['2026-01-01T00:00:00.000Z', '2026-03-01T00:00:00.000Z', '2026-06-01T00:00:00.000Z'] as const;
const MOTIVES = [null, 'travel', 'work', 'family'] as const;

function randomStored(next: () => number): Record<string, unknown> {
  const phrases: LearnerProfile['phrases'] = {};
  for (const fr of ['bonjour', 'merci', 'salut', 'oui', 'pardon']) {
    if (next() < 0.35) continue;
    const used = Math.floor(next() * 5);
    phrases[fr] = phrase(fr, used, used >= MASTERY_USES, ISO[Math.floor(next() * ISO.length)] ?? ISO[0]);
  }
  const errorPatterns: LearnerProfile['errorPatterns'] = {};
  for (const tag of ['gender', 'liaison', 'past-tense']) {
    if (next() < 0.4) continue;
    errorPatterns[tag] = pattern(Math.floor(next() * 6), ISO[Math.floor(next() * ISO.length)] ?? ISO[0], `ex${Math.floor(next() * 3)}`);
  }
  const sessions = Math.floor(next() * 6);
  const forgottenFacts = ['has a dog', 'job interview friday', 'likes jazz', 'moving to lyon'].filter(() => next() < 0.4);
  const learnerGoals = ['Order at a bakery', 'Call the plumber', 'Talk to the neighbours'].filter(() => next() < 0.4);
  // Sometimes a partial answer, as an older install's Settings level edit
  // writes, so the laws below cover the per-sub-answer merge too.
  const sub = <T,>(set: readonly T[]): T | null => (next() < 0.4 ? null : set[Math.floor(next() * set.length)] ?? null);
  const preferences = next() < 0.3 ? {} : { practicePreferences: { level: sub(LEVELS), confidence: sub(CONFIDENCES), focus: sub(FOCUSES) } };
  return stored({
    ...preferences,
    forgottenFacts,
    learnerGoals,
    motivation: MOTIVES[Math.floor(next() * MOTIVES.length)] ?? null,
    username: next() < 0.5 ? null : `camille.${Math.floor(next() * 3)}`,
    onboardedAt: NOW,
    brain: brain({
      phrases,
      errorPatterns,
      cefr: { estimate: 'A1', confidence: 'low', evidence: [] },
      stats: { sessions, totalTurns: sessions * 4 + Math.floor(next() * 3), rescues: 0, lastRung: null },
    }),
  });
}

describe('merging two copies of one learner', () => {
  test('merging two profiles keeps every phrase and error pattern and never doubles mastery', () => {
    const phone = stored({
      brain: brain({
        phrases: {
          // Mastered on both devices. The merge must not read that as six uses.
          merci: phrase('merci', 3, true),
          // Two uses here, two there. A sum would cross the mastery line that
          // nobody in this learner's history ever actually crossed.
          bonjour: phrase('bonjour', 2, false),
          // Mastered on this device only.
          salut: phrase('salut', 3, true),
          // Only this device has ever seen it.
          pardon: phrase('pardon', 1, false),
        },
        errorPatterns: {
          gender: pattern(4, '2026-01-01T00:00:00.000Z'),
          liaison: pattern(2, '2026-02-01T00:00:00.000Z'),
        },
        stats: { sessions: 9, totalTurns: 40, rescues: 1, lastRung: null },
      }),
    });
    const tablet = stored({
      brain: brain({
        phrases: {
          merci: phrase('merci', 3, true),
          bonjour: phrase('bonjour', 2, false),
          salut: phrase('salut', 0, false),
          // Only this device has ever seen it.
          oui: phrase('oui', 4, true),
        },
        errorPatterns: {
          gender: pattern(2, '2026-05-01T00:00:00.000Z'),
          // Only this device has ever seen it.
          'past-tense': pattern(1, '2026-04-01T00:00:00.000Z'),
        },
        stats: { sessions: 2, totalTurns: 8, rescues: 0, lastRung: null },
      }),
    });

    const m = merge(phone, tablet);
    assert.ok(m !== null);
    const p = m.brain.phrases;
    const e = m.brain.errorPatterns;

    // Every phrase either device ever taught is still here.
    assert.deepEqual(Object.keys(p).sort(), ['bonjour', 'merci', 'oui', 'pardon', 'salut']);
    // Every error pattern either device ever noted is still here.
    assert.deepEqual(Object.keys(e).sort(), ['gender', 'liaison', 'past-tense']);

    // Counts take the max, never the sum: mastery is earned once, not twice.
    assert.equal(p.merci?.timesUsedWell, 3);
    assert.equal(p.merci?.mastered, true);
    assert.equal(p.bonjour?.timesUsedWell, 2);
    // Two plus two would be four, which is over the line. It is not summed, and
    // the stored flag is carried rather than recomputed from the count.
    assert.ok(2 + 2 >= MASTERY_USES);
    assert.equal(p.bonjour?.mastered, false);

    // Mastered on one device is mastered: the flag is an OR, never a reset.
    assert.equal(p.salut?.mastered, true);
    assert.equal(p.salut?.timesUsedWell, 3);

    // A phrase only one side has ever seen arrives untouched.
    assert.deepEqual(p.pardon, phrase('pardon', 1, false));
    assert.deepEqual(p.oui, phrase('oui', 4, true));

    // Error patterns: max count, latest sighting.
    assert.equal(e.gender?.count, 4);
    assert.equal(e.gender?.lastSeen, '2026-05-01T00:00:00.000Z');
    assert.equal(e.liaison?.count, 2);
    assert.equal(e['past-tense']?.count, 1);

    // And the same both ways round, because a merge that depends on which
    // device asked is not a merge.
    assert.ok(same(m, merge(tablet, phone, 2, 1)));
  });

  test('the evidence-heavier side keeps its level, memory and stats whole', () => {
    const heavy = stored({
      brain: brain({
        cefr: { estimate: 'B1', confidence: 'high', evidence: ['B1', 'B1', 'B1', 'A2'] },
        memory: { facts: [{ kind: 'life-event', en: 'has a dog', fr: 'a un chien', happensAround: null, notedAt: ISO[1] ?? '' }], opener: { fr: 'Alors ?', en: 'So?' }, name: 'Ana' },
        preferences: { strictness: 'strict', lastScenarios: ['Café'] },
        stats: { sessions: 12, totalTurns: 60, rescues: 3, lastRung: null },
      }),
    });
    const light = stored({
      brain: brain({
        cefr: { estimate: 'A1', confidence: 'low', evidence: ['A1'] },
        memory: { facts: [], opener: null, name: null },
        preferences: { strictness: 'flow', lastScenarios: ['Boulangerie'] },
        stats: { sessions: 2, totalTurns: 5, rescues: 0, lastRung: null },
      }),
    });

    for (const m of [merge(heavy, light), merge(light, heavy)]) {
      assert.ok(m !== null);
      assert.equal(m.brain.cefr.estimate, 'B1');
      assert.equal(m.brain.cefr.confidence, 'high');
      assert.deepEqual(m.brain.cefr.evidence, ['B1', 'B1', 'B1', 'A2']);
      assert.equal(m.brain.memory.facts.length, 1);
      assert.equal(m.brain.memory.name, 'Ana');
      assert.equal(m.brain.preferences.strictness, 'strict');
      assert.equal(m.brain.stats.sessions, 12);
      assert.equal(m.brain.stats.rescues, 3);
    }

    // Turns break a tie on sessions; savedAt breaks a tie on both, so clock
    // skew can never outrank a session that really happened.
    const sameSessions = (turns: number, estimate: 'A2' | 'B2') =>
      stored({ brain: brain({ cefr: { estimate, confidence: 'low', evidence: [] }, stats: { sessions: 4, totalTurns: turns, rescues: 0, lastRung: null } }) });
    assert.equal(merge(sameSessions(10, 'A2'), sameSessions(30, 'B2'))?.brain.cefr.estimate, 'B2');

    const tied = (estimate: 'A2' | 'B2') =>
      stored({ brain: brain({ cefr: { estimate, confidence: 'low', evidence: [] }, stats: { sessions: 4, totalTurns: 10, rescues: 0, lastRung: null } }) });
    assert.equal(merge(tied('A2'), tied('B2'), 100, 200)?.brain.cefr.estimate, 'B2');
    assert.equal(merge(tied('A2'), tied('B2'), 200, 100)?.brain.cefr.estimate, 'A2');
  });

  test('an answer the learner gave beats a null from the busier device', () => {
    const busy = stored({
      motivation: null,
      username: null,
      name: null,
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    const quiet = stored({
      motivation: 'travel',
      username: 'camille.4821',
      name: 'Camille',
      dailyGoalMin: 10,
      brain: brain({ stats: { sessions: 1, totalTurns: 2, rescues: 0, lastRung: null } }),
    });

    for (const m of [merge(busy, quiet), merge(quiet, busy)]) {
      assert.ok(m !== null);
      assert.equal(m.motivation, 'travel');
      assert.equal(m.username, 'camille.4821');
      assert.equal(m.name, 'Camille');
      assert.equal(m.dailyGoalMin, 10);
    }

    // Two real answers is not the same question: the busier device wins that.
    const alsoAnswered = stored({ motivation: 'work', brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }) });
    assert.equal(merge(alsoAnswered, quiet)?.motivation, 'work');
    assert.equal(merge(quiet, alsoAnswered)?.motivation, 'work');

    // Never asked on either side stays never asked. `false` is not written here
    // and is not invented here.
    const blank = merge(stored(), stored());
    for (const field of PROFILE_ANSWER_FIELDS) assert.equal(blank?.[field], ['practiceDaysPerWeek', 'onboardingGoal', 'onboardingDrink', 'practicePreferences'].includes(field) ? undefined : null, field);
  });

  test("two devices keep each other's practice preference answers when only one answered each", () => {
    // Phone B onboarded and answered all three; phone A, an older install, later
    // wrote a Settings level edit with confidence and focus never asked.
    const phoneB = stored({ practicePreferences: { level: 'zero', confidence: 'hesitant', focus: 'speaking' } });
    const phoneA = stored({
      practicePreferences: { level: 'getby', confidence: null, focus: null },
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    for (const m of [merge(phoneA, phoneB), merge(phoneB, phoneA)]) {
      assert.deepEqual(m?.practicePreferences, { level: 'getby', confidence: 'hesitant', focus: 'speaking' });
    }
  });

  test("a heavier device's real sub-answer beats a lighter device's real sub-answer, field by field", () => {
    const heavy = stored({
      practicePreferences: { level: 'few', confidence: null, focus: 'words' },
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    const light = stored({ practicePreferences: { level: 'confident', confidence: 'comfortable', focus: 'listening' } });
    for (const m of [merge(heavy, light), merge(light, heavy)]) {
      assert.deepEqual(m?.practicePreferences, { level: 'few', confidence: 'comfortable', focus: 'words' });
    }
  });

  test('practice preferences with every sub-answer unanswered merge to never asked', () => {
    const empty = { level: null, confidence: null, focus: null };
    const raw = (x: Record<string, unknown> | null) => mergeStoredProfiles(
      { stored: stored({ practicePreferences: x }), savedAt: 1 },
      { stored: stored({ practicePreferences: empty, brain: brain({ stats: { sessions: 3, totalTurns: 9, rescues: 0, lastRung: null } }) }), savedAt: 2 },
      { now: NOW, upgrade: (p) => (typeof p === 'object' && p !== null ? { ...p } : null) },
    );
    assert.equal(raw(empty)?.practicePreferences, null);
    assert.equal(raw(null)?.practicePreferences, null);
    assert.equal(merge(stored({ practicePreferences: empty }), stored({ practicePreferences: empty }))?.practicePreferences, undefined);
  });

  test('unknown keys inside practice preferences do not survive a merge', () => {
    // A pass-through chain, so the merge itself has to drop them.
    const through: ProfileMergeDeps = { now: NOW, upgrade: (p) => (typeof p === 'object' && p !== null ? { ...p } : null) };
    const a = stored({ practicePreferences: { level: 'few', confidence: null, focus: null, note: 'free text' } });
    const b = stored({ practicePreferences: { level: null, confidence: 'trying', focus: null, extra: 7 } });
    for (const m of [mergeStoredProfiles({ stored: a, savedAt: 1 }, { stored: b, savedAt: 2 }, through), mergeStoredProfiles({ stored: b, savedAt: 2 }, { stored: a, savedAt: 1 }, through)]) {
      assert.deepEqual(m?.practicePreferences, { level: 'few', confidence: 'trying', focus: null });
    }
  });

  test('a chosen voice beats a null one from either side, and the merge still absorbs its inputs', () => {
    // The voice is the answered question where losing the answer changes who the
    // tutor *is*. Two of the eight catalogue voices are women and the persona is
    // derived from the key, so a null that overwrote `marie` would not degrade
    // to "some other voice" — it would have the tutor introduce herself as a man
    // on the device the learner uses most. That is the whole reason this field is
    // an answer rather than something that rides with the evidence-heavier side.
    const busy = stored({
      tutorVoice: null,
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    const quiet = stored({
      tutorVoice: 'marie',
      brain: brain({ stats: { sessions: 1, totalTurns: 2, rescues: 0, lastRung: null } }),
    });

    for (const m of [merge(busy, quiet), merge(quiet, busy)]) {
      assert.ok(m !== null);
      assert.equal(m.tutorVoice, 'marie', 'the busier device with no voice overwrote the one the learner chose');
      assert.ok(isTutorVoiceKey(m.tutorVoice), 'the merge produced something that is not a catalogue key');
    }

    // Two real choices is a different question, and the busier device wins it —
    // the same rule `motivation` follows, for the same reason: between two
    // answers the learner really gave, evidence decides, not text.
    const alsoChosen = stored({
      tutorVoice: 'emilie',
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    assert.equal(merge(alsoChosen, quiet)?.tutorVoice, 'emilie');
    assert.equal(merge(quiet, alsoChosen)?.tutorVoice, 'emilie');

    // Never chosen on either side stays never chosen. Writing the default here
    // would record a choice nobody made, and the picker could no longer tell a
    // learner who asked for the default from one who has never been asked at all.
    const untouched = merge(stored(), stored());
    assert.equal(untouched?.tutorVoice, null);
    assert.notEqual(untouched?.tutorVoice, DEFAULT_TUTOR_VOICE);

    // And filling that null in must not move the evidence key, or two devices
    // would hand the same profile back and forth forever with nothing changing.
    // This is what `coreSlice` skipping the answer fields buys, pinned on the
    // field that just joined them rather than assumed to have come along.
    const merged = merge(busy, quiet);
    assert.ok(merged !== null);
    assert.ok(same(merged, merge(merged, busy, 2, 1)), 'the result stopped absorbing the side that had no voice');
    assert.ok(same(merged, merge(merged, quiet, 2, 2)), 'the result stopped absorbing the side that chose');
    assert.ok(same(merged, merge(merged, merged, 2, 2)), 'merging the result with itself changed it');
  });

  test('a forget on either device survives the merge as a set union, whichever side is busier', () => {
    // F563. A tombstone is a statement the learner made on one device, and
    // the merge exists so the other one hears it. Taken whole from the
    // evidence-heavier side, a forget made on the quiet phone would be undone
    // by the busy one on the next sync.
    const busy = stored({
      forgottenFacts: ['likes jazz'],
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    const quiet = stored({
      forgottenFacts: ['has a dog', 'job interview friday'],
      brain: brain({ stats: { sessions: 1, totalTurns: 2, rescues: 0, lastRung: null } }),
    });
    for (const m of [merge(busy, quiet), merge(quiet, busy)]) {
      assert.ok(m !== null);
      assert.deepEqual(m.forgottenFacts, ['has a dog', 'job interview friday', 'likes jazz'], 'a forget was lost to the busier device');
    }
    assert.deepEqual(PROFILE_UNION_FIELDS, ['forgottenFacts'], 'the union set grew or shrank; say why here');

    // Sorted, so two devices that forgot in a different order agree byte for
    // byte, and the union absorbs its inputs like everything else here.
    const merged = merge(busy, quiet);
    assert.ok(merged !== null);
    assert.ok(same(merged, merge(merged, busy, 2, 1)), 'the result stopped absorbing the side with one tombstone');
    assert.ok(same(merged, merge(merged, quiet, 2, 2)), 'the result stopped absorbing the side with two');
    assert.ok(same(merged, merge(merged, merged, 2, 2)), 'merging the result with itself changed it');

    // Junk in the slot is not a forget: only strings ride, and no side can
    // carry a number into the account copy.
    const junk = merge(stored({ forgottenFacts: ['has a dog', 7, null] }), stored());
    assert.deepEqual(junk?.forgottenFacts, ['has a dog']);
  });

  test("the learner's goals ride whole with the evidence-heavier side, like every other outer field", () => {
    // There is no clock to order two goal lists by, and a per-field
    // newest-wins would break the absorption property the tests below hold.
    // So the busier device's list is the list, and the loss is named here.
    const busy = stored({
      learnerGoals: ['Order at a bakery'],
      brain: brain({ stats: { sessions: 20, totalTurns: 90, rescues: 0, lastRung: null } }),
    });
    const quiet = stored({
      learnerGoals: ['Call the plumber', 'Talk to the neighbours'],
      brain: brain({ stats: { sessions: 1, totalTurns: 2, rescues: 0, lastRung: null } }),
    });
    for (const m of [merge(busy, quiet), merge(quiet, busy)]) {
      assert.ok(m !== null);
      assert.deepEqual(m.learnerGoals, ['Order at a bakery'], 'the goals were not taken whole from the busier device');
    }
    const blank = merge(stored(), stored());
    assert.deepEqual(blank?.learnerGoals, [], 'goals nobody wrote were invented');
  });

  test('both doors run: the version chain on every side and on the result, and repairProfile on the brain', () => {
    chainCalls = 0;
    // A version-1 outer whose brain predates `memory` entirely.
    const old: Record<string, unknown> = {
      version: 1,
      motivation: 'want',
      onboardedAt: 1,
      brain: {
        version: 1,
        cefr: { estimate: 'A1', confidence: 'low', evidence: [] },
        errorPatterns: { gender: pattern(2, ISO[0]) },
        phrases: { merci: phrase('merci', 1, false) },
        preferences: { strictness: 'balanced', lastScenarios: [] },
        stats: { sessions: 3, totalTurns: 9, rescues: 0, lastRung: null },
      },
    };
    const current = stored({ brain: brain({ stats: { sessions: 1, totalTurns: 1, rescues: 0, lastRung: null } }) });

    const m = merge(old, current);
    assert.ok(m !== null);
    // Two sides in, one result back out: three passes through the chain.
    assert.equal(chainCalls, 3);
    // Re-pointed from 4 when the app's chain reached v6, and again at v7, which is the fact this
    // line was always reading: the result comes back out through the chain and
    // therefore wears the version the chain writes, whatever that has become.
    assert.equal(m.version, 8);
    assert.equal(m.ageConfirmed, null);
    assert.equal(m.motivation, 'want');
    // repairProfile brought the brain to version 2 and filled the memory it
    // predates — without throwing away a single phrase or pattern.
    assert.equal(m.brain.version, 2);
    assert.deepEqual(m.brain.memory, { facts: [], opener: null, name: null });
    assert.equal(m.brain.phrases.merci?.timesUsedWell, 1);
    assert.equal(m.brain.errorPatterns.gender?.count, 2);
  });

  test('the caps come back on afterwards, and both devices drop the same entries', () => {
    const half = (from: number, count: number): LearnerProfile['phrases'] => {
      const out: LearnerProfile['phrases'] = {};
      for (let i = from; i < from + count; i += 1) out[`p${String(i).padStart(4, '0')}`] = phrase(`p${i}`, 0, false, ISO[0]);
      return out;
    };
    const patterns = (from: number, count: number): LearnerProfile['errorPatterns'] => {
      const out: LearnerProfile['errorPatterns'] = {};
      for (let i = from; i < from + count; i += 1) out[`t${String(i).padStart(4, '0')}`] = pattern(1, ISO[0]);
      return out;
    };

    const a = stored({ brain: brain({ phrases: half(0, 150), errorPatterns: patterns(0, 30), stats: { sessions: 5, totalTurns: 20, rescues: 0, lastRung: null } }) });
    const b = stored({ brain: brain({ phrases: half(100, 150), errorPatterns: patterns(20, 30), stats: { sessions: 4, totalTurns: 18, rescues: 0, lastRung: null } }) });

    const forwards = merge(a, b);
    const backwards = merge(b, a, 2, 1);
    assert.ok(forwards !== null && backwards !== null);
    assert.equal(Object.keys(forwards.brain.phrases).length, MAX_PHRASES);
    assert.equal(Object.keys(forwards.brain.errorPatterns).length, MAX_ERROR_PATTERNS);
    // The union was 250 phrases and 50 patterns. Which ones survived must not
    // depend on which device did the merging.
    assert.deepEqual(Object.keys(forwards.brain.phrases), Object.keys(backwards.brain.phrases));
    assert.deepEqual(Object.keys(forwards.brain.errorPatterns), Object.keys(backwards.brain.errorPatterns));

    // Eviction still prefers to forget what was never learned.
    const mixed = stored({
      brain: brain({
        phrases: { ...half(0, MAX_PHRASES), zzz: phrase('zzz', 3, true, ISO[2]) },
        stats: { sessions: 5, totalTurns: 20, rescues: 0, lastRung: null },
      }),
    });
    const kept = merge(mixed, stored());
    assert.equal(kept?.brain.phrases.zzz?.mastered, true);
  });

  test('an unreadable side is quarantined and never overwrites the good one', () => {
    const good = stored({
      motivation: 'travel',
      brain: brain({ phrases: { merci: phrase('merci', 3, true) }, stats: { sessions: 7, totalTurns: 30, rescues: 0, lastRung: null } }),
    });
    const alone = merge(good, good);

    for (const rubbish of [null, undefined, 'profile', 42, [], { version: 99 }, {}]) {
      const forwards = merge(good, rubbish);
      const backwards = merge(rubbish, good);
      assert.ok(forwards !== null, `forwards: ${JSON.stringify(rubbish) ?? 'undefined'}`);
      assert.equal(forwards.motivation, 'travel');
      assert.equal(forwards.brain.phrases.merci?.timesUsedWell, 3);
      assert.equal(forwards.brain.stats.sessions, 7);
      assert.ok(same(forwards, alone));
      assert.ok(same(backwards, alone));
    }

    // A readable outer wrapped around an unreadable brain loses on evidence
    // rather than being trusted, and contributes no phrases.
    const halfBad = stored({ brain: 'not a brain' });
    const survived = merge(good, halfBad);
    assert.equal(survived?.brain.phrases.merci?.timesUsedWell, 3);
    assert.equal(survived?.brain.stats.sessions, 7);

    // Neither side readable is the caller's cue to quarantine, not to write.
    assert.equal(merge('nonsense', { version: 99 }), null);
  });

  test('it is commutative, idempotent and absorbing over random profiles', () => {
    const next = rng(20_260_826);
    for (let i = 0; i < 300; i += 1) {
      const a = randomStored(next);
      const b = randomStored(next);
      const sa = Math.floor(next() * 5);
      const sb = Math.floor(next() * 5);

      const ab = merge(a, b, sa, sb);
      assert.ok(ab !== null);
      assert.ok(same(ab, merge(b, a, sb, sa)), `commutative, round ${i}`);
      const top = Math.max(sa, sb);
      assert.ok(same(ab, merge(ab, ab, top, top)), `idempotent, round ${i}`);
      assert.ok(same(ab, merge(ab, a, top, sa)), `absorbs a, round ${i}`);
      assert.ok(same(ab, merge(ab, b, top, sb)), `absorbs b, round ${i}`);
      assert.ok(same(ab, merge(a, ab, sa, top)), `absorbs a, reversed, round ${i}`);
    }
  });

  test('three devices gossiping in any order converge on the same profile', () => {
    const next = rng(4_821);
    for (let round = 0; round < 120; round += 1) {
      const devices: Record<string, unknown>[] = [randomStored(next), randomStored(next), randomStored(next)];
      const savedAt = [1, 2, 3];
      let server: unknown = devices[0];
      let serverSavedAt = 1;

      for (let step = 0; step < 30; step += 1) {
        const i = Math.floor(next() * devices.length);
        const merged = merge(devices[i], server, savedAt[i] ?? 0, serverSavedAt);
        assert.ok(merged !== null);
        const at = Math.max(savedAt[i] ?? 0, serverSavedAt);
        devices[i] = merged;
        savedAt[i] = at;
        server = merged;
        serverSavedAt = at;
        // Duplicate pushes and replays are ordinary here, not exceptional.
        if (next() < 0.4) {
          server = merge(server, merged, serverSavedAt, at);
          assert.ok(server !== null);
        }
      }

      // Everyone reconnects once more and adopts what the account holds.
      for (let pass = 0; pass < 2; pass += 1) {
        for (let i = 0; i < devices.length; i += 1) {
          const merged = merge(devices[i], server, savedAt[i] ?? 0, serverSavedAt);
          assert.ok(merged !== null);
          const at = Math.max(savedAt[i] ?? 0, serverSavedAt);
          devices[i] = merged;
          savedAt[i] = at;
          server = merged;
          serverSavedAt = at;
        }
      }

      assert.ok(same(devices[0], devices[1]), `devices 0 and 1 agree, round ${round}`);
      assert.ok(same(devices[1], devices[2]), `devices 1 and 2 agree, round ${round}`);
      assert.ok(same(devices[0], server), `devices agree with the account, round ${round}`);
    }
  });

  test('the one thing that is not associative is named here, not discovered later', () => {
    // Three devices, three different answers to one question, and the heaviest
    // never answered it. See the counterexample in merge.ts.
    const withMotive = (motivation: string | null, sessions: number) =>
      stored({ motivation, brain: brain({ stats: { sessions, totalTurns: sessions * 4, rescues: 0, lastRung: null } }) });
    const a = withMotive(null, 9);
    const b = withMotive('travel', 5);
    const c = withMotive('work', 1);

    assert.equal(merge(merge(a, b), c)?.motivation, 'travel');
    assert.equal(merge(merge(a, c), b)?.motivation, 'work');

    // Both are answers the learner really gave, and the learning is untouched
    // either way — the union does not care which order the devices met in.
    const left = merge(merge(a, b), c);
    const right = merge(merge(a, c), b);
    assert.deepEqual(left?.brain.phrases, right?.brain.phrases);
    assert.deepEqual(left?.brain.errorPatterns, right?.brain.errorPatterns);
    assert.equal(left?.brain.stats.sessions, 9);
    assert.equal(right?.brain.stats.sessions, 9);
  });

  test('mergeLearnerProfiles works on two brains with no envelope around them', () => {
    const a = brain({
      phrases: { merci: phrase('merci', 3, true) },
      errorPatterns: { gender: pattern(4, ISO[0]) },
      stats: { sessions: 6, totalTurns: 20, rescues: 0, lastRung: null },
    });
    const b = brain({
      phrases: { oui: phrase('oui', 1, false) },
      errorPatterns: { gender: pattern(1, ISO[2]) },
      stats: { sessions: 1, totalTurns: 3, rescues: 0, lastRung: null },
    });

    const m = mergeLearnerProfiles(a, b, 1, 2);
    assert.deepEqual(Object.keys(m.phrases).sort(), ['merci', 'oui']);
    assert.equal(m.errorPatterns.gender?.count, 4);
    assert.equal(m.errorPatterns.gender?.lastSeen, ISO[2]);
    assert.equal(m.stats.sessions, 6);
    assert.ok(same(m, mergeLearnerProfiles(b, a, 2, 1)));

    // Rubbish on either side degrades to the good one, never to a crash.
    assert.ok(same(mergeLearnerProfiles(a, 'nonsense', 1, 2), mergeLearnerProfiles(a, a, 1, 2)));
    assert.deepEqual(mergeLearnerProfiles(null, undefined, 0, 0), createProfile());
  });
});
