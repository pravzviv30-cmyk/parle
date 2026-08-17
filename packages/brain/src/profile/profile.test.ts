import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  EVIDENCE_WINDOW,
  MASTERY_USES,
  MAX_ERROR_PATTERNS,
  MAX_MEMORY_FACTS,
  MAX_PHRASES,
  applyExtractionToProfile,
  applyTurnToProfile,
  createProfile,
  finishSession,
  learnerSnapshotFrom,
  migrateProfile,
  type LearnerProfile,
} from './profile.ts';
import { createConversation } from '../engine/conversation.ts';
import { CAFE_FRAME } from '../fixtures.ts';
import { sampleTurn } from '../contract/samples.ts';
import type { TutorTurn } from '../contract/types.ts';
import type { CefrBand } from '../types.ts';

const NOW = '2026-08-14T10:00:00.000Z';

function taughtTurn(overrides: Partial<TutorTurn> = {}): TutorTurn {
  return sampleTurn({
    newPhrases: [
      { fr: "j'sais pas", frWritten: 'je sais pas', en: "I don't know", enLiteral: null, register: 'courant', note: null },
    ],
    ...overrides,
  });
}

describe('applyTurnToProfile', () => {
  test('is pure — the original profile is untouched', () => {
    const profile = createProfile();
    const before = structuredClone(profile);
    applyTurnToProfile(profile, taughtTurn(), NOW);
    assert.deepEqual(profile, before);
  });

  test('new phrases land keyed by their forgiving written form', () => {
    const next = applyTurnToProfile(createProfile(), taughtTurn(), NOW);
    const entry = next.phrases['je sais pas'];
    assert.ok(entry, 'phrase missing under its normalised key');
    assert.equal(entry.fr, "j'sais pas");
    assert.equal(entry.timesUsedWell, 0);
  });

  test(`credit matches forgivingly and mastery lands at ${MASTERY_USES} uses`, () => {
    let profile = applyTurnToProfile(createProfile(), taughtTurn(), NOW);
    const credit = sampleTurn({
      profileSignals: { errorPatterns: [], usedWell: ['JE SAIS PAS'] }, // case and accents must not matter
    });
    for (let i = 0; i < MASTERY_USES; i += 1) {
      assert.equal(profile.phrases['je sais pas']!.mastered, false);
      profile = applyTurnToProfile(profile, credit, NOW);
    }
    assert.equal(profile.phrases['je sais pas']!.timesUsedWell, MASTERY_USES);
    assert.equal(profile.phrases['je sais pas']!.mastered, true);
  });

  test('error tags normalize, count, and keep their example', () => {
    const turn = sampleTurn({
      profileSignals: { errorPatterns: [{ tag: 'Ne Retention!', example: 'je ne sais pas' }], usedWell: [] },
    });
    let profile = applyTurnToProfile(createProfile(), turn, NOW);
    profile = applyTurnToProfile(profile, turn, NOW);
    assert.equal(profile.errorPatterns['ne-retention']!.count, 2);
    assert.equal(profile.errorPatterns['ne-retention']!.example, 'je ne sais pas');
  });

  test('the pattern store evicts the least recently seen past the cap', () => {
    let profile = createProfile();
    for (let i = 0; i < MAX_ERROR_PATTERNS + 5; i += 1) {
      const turn = sampleTurn({
        profileSignals: { errorPatterns: [{ tag: `tag-${String(i).padStart(3, '0')}`, example: 'x' }], usedWell: [] },
      });
      profile = applyTurnToProfile(profile, turn, `2026-08-14T10:${String(i).padStart(2, '0')}:00.000Z`);
    }
    assert.equal(Object.keys(profile.errorPatterns).length, MAX_ERROR_PATTERNS);
    assert.equal(profile.errorPatterns['tag-000'], undefined, 'oldest should have been evicted');
    assert.ok(profile.errorPatterns['tag-044'], 'newest must survive');
  });

  test(`CEFR evidence keeps a window of ${EVIDENCE_WINDOW}`, () => {
    let profile = createProfile();
    for (let i = 0; i < EVIDENCE_WINDOW + 4; i += 1) {
      const turn = sampleTurn();
      profile = applyTurnToProfile(profile, turn, NOW);
    }
    assert.equal(profile.cefr.evidence.length, EVIDENCE_WINDOW);
  });

  test(`the phrase book is capped at ${MAX_PHRASES} — the profile rides the join token, which has a size ceiling`, () => {
    let profile = createProfile();
    for (let i = 0; i < MAX_PHRASES + 10; i += 1) {
      const turn = sampleTurn({
        newPhrases: [
          { fr: `phrase numéro ${i}`, frWritten: null, en: `phrase number ${i}`, enLiteral: null, register: 'courant', note: null },
        ],
      });
      // Distinct, monotonic timestamps so eviction has a real order to read.
      profile = applyTurnToProfile(profile, turn, new Date(Date.parse(NOW) + i * 1000).toISOString());
    }
    assert.equal(Object.keys(profile.phrases).length, MAX_PHRASES);
    const kept = Object.values(profile.phrases).map((p) => p.fr);
    assert.ok(!kept.includes('phrase numéro 0'), 'oldest unmastered phrase should have been evicted');
    assert.ok(kept.includes(`phrase numéro ${MAX_PHRASES + 9}`), 'newest must survive');
  });
});

describe('finishSession', () => {
  function endedState(strictness: 'flow' | 'balanced' | 'strict' = 'balanced') {
    return createConversation(
      CAFE_FRAME,
      { cefr: 'A2', confidence: 'low', watchFor: [], lastRung: null, sessions: 0 },
      { strictness, maxTurns: 24 },
      1_000,
    );
  }

  test('folds the ladder story and remembers the scene and the dial', () => {
    const next = finishSession(createProfile(), endedState('strict'));
    assert.equal(next.stats.sessions, 1);
    assert.equal(next.stats.lastRung, 3);
    assert.equal(next.preferences.strictness, 'strict');
    assert.deepEqual(next.preferences.lastScenarios, ['Au café du coin']);
  });

  test('the estimate moves at most one band per session, whatever the evidence says', () => {
    const profile: LearnerProfile = {
      ...createProfile(),
      cefr: { estimate: 'A0', confidence: 'low', evidence: ['B2', 'B2', 'B2', 'B2', 'B2', 'B2'] as CefrBand[] },
    };
    const next = finishSession(profile, endedState());
    assert.equal(next.cefr.estimate, 'A1', 'jumped more than one band');
    assert.equal(next.cefr.confidence, 'high', 'agreement that strong is high confidence');
  });

  test('thin evidence never moves the estimate and stays low confidence', () => {
    const profile: LearnerProfile = {
      ...createProfile(),
      cefr: { estimate: 'A2', confidence: 'medium', evidence: ['B1', 'B1'] as CefrBand[] },
    };
    const next = finishSession(profile, endedState());
    assert.equal(next.cefr.estimate, 'A2');
    assert.equal(next.cefr.confidence, 'low');
  });

  test('the scenario list dedupes and caps at five', () => {
    let profile = createProfile();
    for (let i = 0; i < 7; i += 1) profile = finishSession(profile, endedState());
    assert.deepEqual(profile.preferences.lastScenarios, ['Au café du coin']);
  });
});

describe('learnerSnapshotFrom', () => {
  test('surfaces the top recurring troubles as watch-fors', () => {
    let profile = createProfile();
    const tags = [
      ['ne-retention', 3],
      ['gender-agreement', 2],
      ['tu-vous-mixing', 5],
      ['liaison', 1],
    ] as const;
    for (const [tag, count] of tags) {
      for (let i = 0; i < count; i += 1) {
        profile = applyTurnToProfile(
          profile,
          sampleTurn({ profileSignals: { errorPatterns: [{ tag, example: 'x' }], usedWell: [] } }),
          NOW,
        );
      }
    }
    const snapshot = learnerSnapshotFrom(profile);
    assert.deepEqual(snapshot.watchFor, ['tu-vous-mixing', 'ne-retention', 'gender-agreement']);
  });
});

describe('memory — what the tutor knows about the person', () => {
  const fact = (en: string, kind: 'interest' | 'life-event' | 'goal' | 'preference' = 'interest') => ({
    kind,
    fr: null,
    en,
    happensAround: null,
  });

  test('facts merge deduped on their English sentence, opener lands whole or not at all', () => {
    let profile = createProfile();
    profile = applyExtractionToProfile(
      profile,
      { facts: [fact('They love the metro system'), fact('They LOVE the métro system')], openerFr: 'Alors, le métro ?', openerEn: 'So, the metro?' },
      '2026-08-17T10:00:00Z',
    );
    assert.equal(profile.memory.facts.length, 1, 'near-duplicates collapse on the normalised sentence');
    assert.deepEqual(profile.memory.opener, { fr: 'Alors, le métro ?', en: 'So, the metro?' });

    // Half an opener is no opener: the next session must never speak French
    // the screen cannot gloss.
    profile = applyExtractionToProfile(profile, { facts: [], openerFr: 'Et le travail ?', openerEn: null }, '2026-08-17T11:00:00Z');
    assert.equal(profile.memory.opener, null);
  });

  test('the fact book caps oldest-out — the profile rides the join credential', () => {
    let profile = createProfile();
    for (let i = 0; i < MAX_MEMORY_FACTS + 3; i += 1) {
      profile = applyExtractionToProfile(
        profile,
        { facts: [fact(`Fact number ${String.fromCharCode(97 + i)}`)], openerFr: null, openerEn: null },
        `2026-08-${String(i + 1).padStart(2, '0')}T10:00:00Z`,
      );
    }
    assert.equal(profile.memory.facts.length, MAX_MEMORY_FACTS);
    assert.equal(profile.memory.facts[0]!.en, 'Fact number d', 'the three oldest were evicted');
  });

  test('a version-1 profile migrates additively, learning history untouched', () => {
    const v2 = createProfile();
    v2.stats.sessions = 7;
    v2.cefr.evidence.push('A1');
    const stored = JSON.parse(JSON.stringify(v2)) as Record<string, unknown>;
    delete stored.memory;
    (stored as { version: number }).version = 1;

    const migrated = migrateProfile(stored as never);
    assert.equal(migrated.version, 2);
    assert.deepEqual(migrated.memory, { facts: [], opener: null });
    assert.equal(migrated.stats.sessions, 7);
    assert.deepEqual(migrated.cefr.evidence, ['A1']);

    // Already-current profiles pass through untouched, same object and all.
    assert.equal(migrateProfile(v2), v2);
  });
});
