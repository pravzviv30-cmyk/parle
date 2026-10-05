import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  CHEST,
  CHEST_XP,
  MONTHLY_QUEST_TARGET,
  QUESTS,
  QUEST_XP,
  questDef,
  questEligible,
  questTarget,
  questTitle,
  type QuestEligibility,
  type QuestId,
} from './catalogue.ts';
import { DAY_ONE_QUESTS, fnv1a, mulberry32, questsForDay } from './select.ts';
import { monthlyQuestCount, questProgress, questsToClaim, type DayFacts, type QuestClaim } from './progress.ts';

const everything: QuestEligibility = { practiceDaysBefore: 10, phraseCards: 40, conversations: 3, liveSecondsRemaining: 600 };

const days = (n: number) => Array.from({ length: n }, (_, i) => new Date(Date.UTC(2026, 9, 1 + i)).toISOString().slice(0, 10));

const noFacts: DayFacts = {
  finished: 0,
  phrasePractices: 0,
  recalled: 0,
  conversations: 0,
  practiceSets: 0,
  xp: 0,
  minutes: 0,
  goalMet: false,
  newPhrases: 0,
  scenesOnOwn: 0,
  soundChecks: 0,
};

describe('picking a day\'s quests', () => {
  test('the same seed and day always pick the same three quests', () => {
    for (const day of days(30)) {
      const first = questsForDay({ day, seed: 'learner-1', eligibility: everything, goalTarget: 10 });
      const again = questsForDay({ day, seed: 'learner-1', eligibility: { ...everything }, goalTarget: 10 });
      assert.deepEqual(again, first, `${day} picked differently the second time`);
      assert.equal(new Set(first).size, 3);
    }
    // Pinned: two devices on different builds must agree, so a change to the
    // hash, the generator or the catalogue order has to fail here first.
    assert.deepEqual(questsForDay({ day: '2026-10-05', seed: 'learner-1', eligibility: everything, goalTarget: 10 }), [
      'practise-twice',
      'conversation',
      'minutes',
    ]);
    assert.deepEqual(questsForDay({ day: '2026-10-06', seed: 'learner-1', eligibility: everything, goalTarget: 10 }), [
      'review-recall',
      'conversation',
      'sound-check',
    ]);
  });

  test('the hash and the generator are the published FNV-1a and mulberry32', () => {
    assert.equal(fnv1a(''), 0x811c9dc5);
    assert.equal(fnv1a('a'), 0xe40c292c);
    assert.equal(fnv1a('foobar'), 0xbf9cf968);
    assert.equal(mulberry32(1)(), 0.6270739405881613);
    const a = mulberry32(42);
    const b = mulberry32(42);
    for (let i = 0; i < 20; i += 1) {
      const x = a();
      assert.equal(x, b());
      assert.ok(x >= 0 && x < 1);
    }
  });

  test('different days and different learners get different quests', () => {
    const picks = new Set(days(60).map((day) => questsForDay({ day, seed: 'learner-1', eligibility: everything, goalTarget: 10 }).join()));
    assert.ok(picks.size >= 10, `only ${picks.size} different sets in 60 days`);
    const learners = new Set(['a', 'b', 'c', 'd', 'e', 'f', 'g', 'h'].map((seed) => questsForDay({ day: '2026-10-05', seed, eligibility: everything, goalTarget: 10 }).join()));
    assert.ok(learners.size >= 3, 'eight learners all got the same day');
  });

  test('day one is the same three for everyone', () => {
    assert.deepEqual([...DAY_ONE_QUESTS], ['finish-practice', 'phrase-of-day', 'minutes']);
    for (const seed of ['a', 'b', 'learner-1']) {
      assert.deepEqual(
        questsForDay({ day: '2026-10-05', seed, eligibility: { ...everything, practiceDaysBefore: 0 }, goalTarget: 20 }),
        ['finish-practice', 'phrase-of-day', 'minutes'],
      );
    }
  });

  test('a day offers one quest per slot and never two of one family', () => {
    for (const goalTarget of [null, 5, 20] as const) {
      for (const day of days(90)) {
        const picked = questsForDay({ day, seed: `s-${goalTarget}`, eligibility: everything, goalTarget });
        assert.deepEqual(picked.map((id) => questDef(id).slot), ['easy', 'core', 'stretch'], `${day}: ${picked.join()}`);
        assert.equal(new Set(picked.map((id) => questDef(id).family)).size, 3, `${day}: ${picked.join()} repeats a family`);
        for (const id of picked) assert.ok(questEligible(id, everything, goalTarget), `${day}: ${id} was not eligible`);
      }
    }
  });

  test('a quest that needs live minutes is never offered when they are spent or unknown', () => {
    for (const liveSecondsRemaining of [0, null, -5]) {
      const eligibility = { ...everything, liveSecondsRemaining };
      for (const day of days(120)) {
        const picked = questsForDay({ day, seed: 'learner-1', eligibility, goalTarget: 10 });
        assert.ok(!picked.includes('conversation'), `${day} offered a conversation with ${liveSecondsRemaining} seconds`);
        assert.ok(!picked.includes('scene-on-own'), `${day} offered a scene with ${liveSecondsRemaining} seconds`);
      }
    }
    // With minutes confirmed, the conversation is offered on some days.
    const offered = days(60).some((day) => questsForDay({ day, seed: 'learner-1', eligibility: everything, goalTarget: 10 }).includes('conversation'));
    assert.ok(offered);
  });

  test('every quest has a quiet way through, and each rule of eligibility holds', () => {
    assert.equal(QUESTS.length, 12);
    assert.deepEqual(QUESTS.filter((q) => q.requiresSpeaking).map((q) => q.id), [], 'a quest needs speaking aloud');
    assert.ok(!questEligible('practise-twice', { ...everything, practiceDaysBefore: 0 }, 10));
    assert.ok(!questEligible('review-recall', { ...everything, phraseCards: 4 }, 10));
    assert.ok(questEligible('review-recall', { ...everything, phraseCards: 5 }, 10));
    assert.ok(!questEligible('scene-on-own', { ...everything, conversations: 0 }, 10));
    assert.ok(!questEligible('goal', everything, null));
    assert.ok(questEligible('goal', everything, 5));
    const quiet = { ...everything, liveSecondsRemaining: null };
    for (const id of ['finish-practice', 'phrase-of-day', 'practice-set', 'xp', 'minutes', 'new-phrases', 'sound-check'] as const) {
      assert.ok(questEligible(id, { ...quiet, phraseCards: 0, conversations: 0 }, null), `${id} should always be on offer`);
    }
  });
});

describe('quest progress and claims', () => {
  test('titles are exact, with the tutor and the XP target filled in', () => {
    const titles = Object.fromEntries(QUESTS.map((q) => [q.id, questTitle(q.id, { tutorName: 'Alexandre', goalTarget: 15 })]));
    assert.deepEqual(titles, {
      'finish-practice': 'Finish a practice',
      'phrase-of-day': "Say today's phrase",
      'practise-twice': 'Practise twice today',
      'review-recall': 'Remember 5 phrases in review',
      conversation: 'Finish a conversation with Alexandre',
      'practice-set': 'Finish a short practice set',
      xp: 'Earn 50 XP',
      minutes: 'Practise for 5 minutes',
      'new-phrases': 'Add 3 new phrases to your deck',
      'scene-on-own': 'Finish a scene on your own',
      'sound-check': 'Try a sound check',
      goal: 'Meet your daily goal',
    });
    assert.equal(questTitle('conversation'), 'Finish a conversation with your tutor');
    assert.deepEqual([5, 10, 15, 20, null].map((g) => questTarget('xp', g as 5 | 10 | 15 | 20 | null)), [30, 40, 50, 60, 30]);
  });

  test('quest progress is capped at the target', () => {
    const facts: DayFacts = { ...noFacts, finished: 7, recalled: 3, xp: 95, minutes: 4, newPhrases: 12 };
    assert.deepEqual(questProgress('practise-twice', facts), { id: 'practise-twice', done: 2, target: 2, complete: true });
    assert.deepEqual(questProgress('review-recall', facts), { id: 'review-recall', done: 3, target: 5, complete: false });
    assert.deepEqual(questProgress('xp', facts, 20), { id: 'xp', done: 60, target: 60, complete: true });
    assert.deepEqual(questProgress('minutes', facts), { id: 'minutes', done: 4, target: 5, complete: false });
    assert.deepEqual(questProgress('new-phrases', facts).done, 3);
    assert.deepEqual(questProgress('goal', { ...facts, goalMet: true }), { id: 'goal', done: 1, target: 1, complete: true });
    assert.deepEqual(questProgress('sound-check', { ...noFacts, soundChecks: Number.NaN }).done, 0);
    assert.deepEqual(questProgress('finish-practice', { ...noFacts, finished: -3 }).done, 0);
  });

  test('each quest and the chest is claimed once a day', () => {
    assert.equal(QUEST_XP, 10);
    assert.equal(CHEST_XP, 15);
    const ids: QuestId[] = ['finish-practice', 'practice-set', 'minutes'];
    const day = '2026-10-05';
    const partway: DayFacts = { ...noFacts, finished: 1, practiceSets: 1, minutes: 3 };
    assert.deepEqual(questsToClaim({ day, ids, facts: partway, goalTarget: 10, claims: [] }), ['finish-practice', 'practice-set']);

    const claims: QuestClaim[] = [
      { day, questId: 'finish-practice' },
      { day, questId: 'practice-set' },
      { day: '2026-10-04', questId: 'minutes' }, // yesterday's, not today's
    ];
    assert.deepEqual(questsToClaim({ day, ids, facts: partway, goalTarget: 10, claims }), []);
    const done: DayFacts = { ...partway, minutes: 6 };
    assert.deepEqual(questsToClaim({ day, ids, facts: done, goalTarget: 10, claims }), ['minutes', CHEST]);
    const all: QuestClaim[] = [...claims, { day, questId: 'minutes' }, { day, questId: CHEST }];
    assert.deepEqual(questsToClaim({ day, ids, facts: done, goalTarget: 10, claims: all }), []);
  });

  test('the monthly count goes by calendar month, counts each quest once and leaves out the chest', () => {
    assert.equal(MONTHLY_QUEST_TARGET, 30);
    const claims: QuestClaim[] = [
      { day: '2026-10-01', questId: 'minutes' },
      { day: '2026-10-01', questId: 'minutes' }, // the same claim from a second device
      { day: '2026-10-01', questId: CHEST },
      { day: '2026-10-31', questId: 'xp' },
      { day: '2026-11-01', questId: 'xp' },
      { day: '2026-09-30', questId: 'goal' },
    ];
    assert.equal(monthlyQuestCount(claims, '2026-10'), 2);
    assert.equal(monthlyQuestCount(claims, '2026-11'), 1);
    assert.equal(monthlyQuestCount(claims, '2026-09'), 1);
  });

  test('quest titles read as plain, kind English', () => {
    // Mirrors the shared ban list in apps/mobile/src/copy/guilt.ts, less
    // "streak", which founder decision D2 retired. Substring on purpose.
    const BANNED = ['missed', 'lost', 'lose', 'break', 'keep it up', "don't", 'do not', 'again tomorrow or', 'failed', 'behind', 'owe'];
    for (const q of QUESTS) {
      const title = questTitle(q.id, { tutorName: 'Alexandre', goalTarget: 10 });
      assert.ok(!/[—–·]/.test(title), `${q.id} uses a dash or a middot`);
      for (const word of BANNED) assert.ok(!title.toLowerCase().includes(word), `${q.id} says "${word}"`);
    }
  });
});
