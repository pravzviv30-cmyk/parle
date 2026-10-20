/**
 * What the direction B Journey tab decides (2026-10-20, B4, B-Journey and the
 * Journey panel of B-Empty-States), asked of `journeyView.ts` directly: the
 * stage mapping and "You're here", the "Earn all n" count, each can-do state's
 * words, help in words only, sounds only with a saved check, the week only
 * with evidence, the lock badges only through the seam, the empty journey,
 * and every door's route.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { FRENCH_PHONEMES, MISSIONS, missionStates, type ReviewCard, type XpLevel } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { missionCompletionsFrom } from '../missions/chooserView.ts';
import { COMPLETIONS_PER_MISSION } from '../missions/store.ts';
import { STATUS, thenNowView } from './thenNowView.ts';
import { SOUND_LINES } from '../myfrench/sounds.ts';
import { REFLECTION_COPY } from '../progress/reflection.ts';
import { STORY_INDEPENDENCE } from '../progress/story.ts';
import type { SoundCheckEvidence } from '../soundcheck/model.ts';
import { stageOf } from '../scenes/scenePreview.ts';
import {
  JOURNEY_COPY,
  JOURNEY_TITLE,
  STAGES,
  YOU_ARE_HERE,
  canDoView,
  collectionTiles,
  dayWord,
  emptyJourney,
  firstLabel,
  triesOf,
  headerStats,
  helpView,
  isEmptyJourney,
  levelHeader,
  segmentsText,
  shortDate,
  soundsView,
  stagesFrom,
  startingOutMissions,
  thenNowCard,
  usedView,
  weekView,
  type StoredCompletion,
} from './journeyView.ts';

const DAY = 24 * 60 * 60 * 1000;
// A Tuesday, at noon local time, so day words are stable across zones.
const NOW = new Date(2026, 9, 20, 12, 0, 0).getTime();

const progressOf = (stored: readonly StoredCompletion[]) => missionStates(missionCompletionsFrom(stored), [], NOW);
const A0 = MISSIONS.filter((m) => m.cefr === 'A0').map((m) => m.id);

function card(over: Partial<ReviewCard> = {}): ReviewCard {
  return {
    id: 'phrase:one', kind: 'vocab', front: 'je voudrais un croissant', back: 'I would like a croissant', context: '', ipa: '',
    addedAt: NOW - 10 * DAY, due: NOW + DAY, intervalDays: 6, ease: 2.5, reps: 3, lapses: 0,
    evidence: { retrievals: 1, convoUses: 1, transfers: 0 },
    ...over,
  };
}

function check(over: Partial<SoundCheckEvidence> = {}): SoundCheckEvidence {
  return { missionId: 'mission:cafe', reference: 'Bonjour', at: NOW - DAY, kind: 'assessed-clear', focus: null, phoneme: null, ...over };
}

describe('the header: the stage word, the level and the counts', () => {
  test('the stages are the founder\'s words, never a CEFR code, and "You\'re here" sits on the real stage', () => {
    // 2026-10-20, B4 review: Starter, not "Starting out", which stays Explore's difficulty label.
    assert.deepEqual([...STAGES], ['Starter', 'Basics', 'Everyday', 'Chatting', 'Confident']);
    // One word for the first stage across the app: the scene preview's.
    assert.equal(stageOf({ kind: 'mission', cefr: 'A0' }), STAGES[0]);
    assert.equal(stageOf({ kind: 'mission', cefr: 'A1' }), STAGES[1]);

    const fresh = stagesFrom(progressOf([]));
    assert.equal(fresh.eyebrow, 'Starter stage');
    assert.deepEqual(fresh.steps.map((s) => s.state), ['here', 'ahead', 'ahead', 'ahead', 'ahead']);
    assert.match(fresh.steps[0]!.accessibilityLabel, new RegExp(`Stage 1, Starter, ${YOU_ARE_HERE}`));

    const allA0 = stagesFrom(progressOf(A0.map((id, i) => ({ id, at: NOW - i * DAY, rung: 4 }))));
    assert.equal(allA0.eyebrow, 'Basics stage');
    assert.deepEqual(allA0.steps.map((s) => s.state), ['done', 'here', 'ahead', 'ahead', 'ahead']);
    assert.equal(allA0.moveUp, null, 'the future stages make no claim about how to reach them');
    for (const view of [fresh, allA0]) for (const step of view.steps) assert.doesNotMatch(`${step.label} ${step.accessibilityLabel}`, /\bA[012]\b|B[12]|CEFR/);
  });

  test('"Earn all n" counts the real A0 missions on the spine', () => {
    const n = startingOutMissions().length;
    assert.equal(n, A0.length);
    assert.equal(stagesFrom(progressOf([])).moveUp, `Earn all ${n} Starter abilities to move up to Basics.`);
  });

  test('the level reads "x of y XP" and its bar is labelled; unread draws nothing', () => {
    const level: XpLevel = { level: 2, intoLevel: 140, levelSpan: 250, toNext: 110 };
    const view = levelHeader(level)!;
    assert.equal(view.title, 'Level 2');
    assert.equal(view.xp, '140 of 250 XP');
    assert.equal(view.fraction, 140 / 250);
    assert.equal(view.barLabel, 'Level 2, 140 of 250 XP towards level 3');
    assert.equal(levelHeader(null), null);
  });

  test('the counts are days in a row, minutes practised (never "spoken") and phrases kept, and an unread one is left out', () => {
    assert.deepEqual(headerStats({ daysInARow: 3, minutes: 11.7, phrases: 8 }).map((s) => [s.value, s.label]), [['3', 'days in a row'], ['11', 'min practised'], ['8', 'phrases kept']]);
    assert.deepEqual(headerStats({ daysInARow: 1, minutes: null, phrases: 1 }).map((s) => [s.value, s.label]), [['1', 'day in a row'], ['1', 'phrase kept']]);
    for (const stat of headerStats({ daysInARow: 3, minutes: 4, phrases: 2 })) assert.doesNotMatch(stat.label, /spoken/);
  });
});

describe('what you can do', () => {
  test('earned, with help and not started each say their own line, and nothing counts them', () => {
    const stored: StoredCompletion[] = [
      { id: 'mission:premier-cafe', at: NOW - 4 * DAY, rung: 1 },
      { id: 'mission:premier-cafe', at: NOW - 4 * DAY + 1000, rung: 4 },
      { id: 'mission:cafe', at: NOW - DAY, rung: 2 },
    ];
    const view = canDoView({ progress: progressOf(stored), completions: stored, now: NOW });
    const byId = new Map(view.rows.map((row) => [row.missionId, row]));
    const earned = byId.get('mission:premier-cafe')!;
    assert.equal(earned.mark, 'earned');
    assert.equal(earned.title, 'Order a coffee at the counter');
    assert.equal(segmentsText(earned.line), 'Earned Friday, without help');
    const helped = byId.get('mission:cafe')!;
    assert.equal(helped.mark, 'helped');
    assert.equal(segmentsText(helped.line), 'So far, with help. Finish Au café du coin on your own to earn it.');
    assert.deepEqual(helped.line.filter((s) => s.fr).map((s) => s.text), ['Au café du coin'], 'the scene name is tagged as French');
    const untouched = byId.get('mission:hotel')!;
    assert.equal(untouched.mark, 'none');
    assert.equal(segmentsText(untouched.line), 'Not started. Comes with À la réception.');
    for (const row of view.rows) assert.doesNotMatch(`${row.title} ${segmentsText(row.line)} ${row.accessibilityLabel}`, /\d+ of \d+|\bof \d/, 'an ability is counted');
    assert.equal(view.locked, false);
  });

  test('the stage lists its own scenes plus any other already walked', () => {
    const view = canDoView({ progress: progressOf([{ id: 'mission:amis', at: NOW, rung: 2 }]), completions: [], now: NOW });
    assert.deepEqual(view.rows.map((r) => r.missionId), [...A0, 'mission:amis'].filter((id) => view.rows.some((r) => r.missionId === id)));
    assert.ok(view.rows.some((r) => r.missionId === 'mission:amis'));
    assert.ok(!view.rows.some((r) => r.missionId === 'mission:marche'), 'an untouched later scene is listed');
  });

  test('day words follow the learner\'s own calendar', () => {
    assert.equal(dayWord(NOW - 60_000, NOW), 'today');
    assert.equal(dayWord(new Date(2026, 9, 19, 23, 59).getTime(), NOW), 'yesterday');
    assert.equal(dayWord(NOW - 4 * DAY, NOW), 'Friday');
    assert.equal(dayWord(NOW - 10 * DAY, NOW), '10 Oct');
    assert.equal(shortDate(new Date(2026, 9, 12, 8).getTime()), '12 Oct');
  });
});

describe('then and now, on the tab', () => {
  test('a scene earned through the bigger one says so, by name, on the tab and on Then and now alike', () => {
    const stored: StoredCompletion[] = [
      { id: 'mission:premier-cafe', at: NOW - 6 * DAY, rung: 2 },
      { id: 'mission:cafe', at: NOW - 2 * DAY, rung: 4 },
    ];
    const progress = progressOf(stored);
    const tab = canDoView({ progress, completions: stored, now: NOW }).rows.find((r) => r.missionId === 'mission:premier-cafe')!;
    assert.equal(tab.mark, 'earned');
    assert.equal(segmentsText(tab.line), 'Earned when you finished Au café du coin on your own');
    assert.deepEqual(tab.line.filter((s) => s.fr).map((s) => s.text), ['Au café du coin']);
    const row = thenNowView({ progress, completions: stored }).rows.find((r) => r.missionId === 'mission:premier-cafe')!;
    assert.equal(row.status, STATUS.earned, 'Then and now disagrees with the tab about what is earned');
    assert.deepEqual(row.note, tab.line);
    // Untried itself, and still earned on both.
    const only: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - DAY, rung: 4 }];
    const untried = thenNowView({ progress: progressOf(only), completions: only }).rows.find((r) => r.missionId === 'mission:premier-cafe')!;
    assert.equal(untried.status, STATUS.earned);
    assert.equal(segmentsText(untried.note!), 'Earned when you finished Au café du coin on your own');
  });

  test('the card says "First try we still have" once retention may have dropped the first, through the shared helper', () => {
    const many: StoredCompletion[] = Array.from({ length: COMPLETIONS_PER_MISSION }, (_, i) => ({ id: 'mission:cafe', at: NOW - (40 - i) * DAY, rung: 2 }));
    assert.match(thenNowCard(many)!.first.label, /^First try we still have, /);
    assert.match(thenNowCard(many.slice(1))!.first.label, /^First, /);
    const tries = triesOf(many, 'mission:cafe');
    assert.equal(thenNowCard(many)!.first.label, firstLabel(tries));
    assert.equal(thenNowView({ progress: progressOf(many), completions: many }).rows.find((r) => r.missionId === 'mission:cafe')!.first!.label, firstLabel(tries));
  });

  test('the most recent guided scene: first next to best, in help words, and See all opens Then and now', () => {
    const stored: StoredCompletion[] = [
      { id: 'mission:premier-cafe', at: new Date(2026, 9, 12, 9).getTime(), rung: 1 },
      { id: 'mission:premier-cafe', at: new Date(2026, 9, 17, 9).getTime(), rung: 4 },
      { id: 'mission:premier-cafe', at: new Date(2026, 9, 18, 9).getTime(), rung: 2 },
    ];
    const view = thenNowCard(stored)!;
    assert.equal(view.scene, 'Le premier café');
    assert.deepEqual(view.first, { label: 'First, 12 Oct', help: 'Line given' });
    assert.deepEqual(view.best, { label: 'Best, 17 Oct', help: 'On your own' }, 'a tired replay took the best away');
    assert.deepEqual(view.route, { screen: 'ThenNow' });
  });

  test('a single try has a first and no best; no tries draws no card', () => {
    const view = thenNowCard([{ id: 'mission:cafe', at: NOW, rung: 2 }])!;
    assert.deepEqual(view.first.help, 'Choices');
    assert.equal(view.best, null);
    assert.equal(thenNowCard([]), null);
    assert.equal(thenNowCard([{ id: 'not-a-mission', at: NOW, rung: 4 }]), null, 'a free conversation has no guided steps');
  });
});

describe('french used, help needed, sounds and the week', () => {
  test('used French is the convoUses lane, with the transfers said as a count of phrases', () => {
    const deck = [
      card({ id: 'a', front: 'je voudrais un croissant', evidence: { retrievals: 1, convoUses: 2, transfers: 1 } }),
      card({ id: 'b', front: 'l’addition, s’il vous plaît', evidence: { retrievals: 1, convoUses: 1, transfers: 0 } }),
      card({ id: 'c', front: 'jamais dit', evidence: { retrievals: 4, convoUses: 0, transfers: 0 } }),
    ];
    const view = usedView({ deck, tutorName: 'Sam', now: NOW })!;
    assert.equal(view.subtitle, 'Phrases you’ve said to Sam');
    assert.deepEqual([...view.phrases].sort(), ['je voudrais un croissant', 'l’addition, s’il vous plaît'].sort());
    // 2026-10-20, B4 review: practice evidence said as practice, over the phrases shown.
    assert.equal(view.transferLine, 'In practice, you also used 1 of these in a new situation');
    assert.equal(usedView({ deck: [deck[2]!], tutorName: 'Sam', now: NOW }), null, 'a deck never used in conversation draws the section');
  });

  test('help is said in words only, from this week\'s guided scenes first, then the story, else nothing', () => {
    const week = (rungs: number[]): StoredCompletion[] => rungs.map((rung, i) => ({ id: 'mission:cafe', at: NOW - i * 3600_000, rung }));
    assert.equal(helpView({ completions: week([4, 4, 3]), story: { sentences: [] }, now: NOW })!.line, STORY_INDEPENDENCE);
    assert.equal(helpView({ completions: week([3, 3, 1]), story: { sentences: [] }, now: NOW })!.line, 'This week a hint was mostly enough.');
    assert.equal(helpView({ completions: week([2]), story: { sentences: [] }, now: NOW })!.line, 'This week you picked from choices.');
    assert.equal(helpView({ completions: week([1, 2]), story: { sentences: [] }, now: NOW })!.line, 'This week you mostly picked from choices.', 'a tie goes to less help');
    const old: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - 9 * DAY, rung: 1 }];
    // 2026-10-20, B4 review: the story's claim is the lessons', and said as theirs.
    assert.equal(helpView({ completions: old, story: { sentences: [STORY_INDEPENDENCE] }, now: NOW })!.line, 'In this week’s lessons, you found the words on your own.');
    assert.equal(helpView({ completions: old, story: { sentences: ['You spent time with French this week.'] }, now: NOW }), null);
    for (const rungs of [[1], [2], [3], [4], [1, 1], [2, 2], [3, 3], [4, 4]]) {
      const line = helpView({ completions: week(rungs), story: { sentences: [] }, now: NOW })!.line;
      assert.doesNotMatch(line, /\d|%|•|●/, `help is counted: ${line}`);
    }
  });

  test('sounds are drawn only when a saved check backs a line, with sounds.ts\'s sentences and no date', () => {
    assert.equal(soundsView({ checks: [], now: NOW, hasJourney: false }), null);
    assert.equal(soundsView({ checks: [check({ kind: 'self-guided' })], now: NOW, hasJourney: false }), null, 'an unmeasured check with no sound named claims a line');
    const [first, second] = FRENCH_PHONEMES;
    const view = soundsView({
      checks: [
        check({ phoneme: first!.ipa, kind: 'assessed-clear', at: NOW - 2 * DAY }),
        check({ phoneme: second!.ipa, kind: 'self-guided', at: NOW - DAY, missionId: 'mission:hotel' }),
        check({ phoneme: 'not-a-sound', kind: 'assessed-focus', focus: 'Try again today', at: NOW - 3600_000 }),
      ],
      now: NOW,
      hasJourney: false,
    })!;
    assert.deepEqual(view.rows.map((r) => [r.ipa, r.line]), [[second!.ipa, SOUND_LINES.selfGuided], [first!.ipa, SOUND_LINES.clear]]);
    assert.equal(view.rows[0]!.example, second!.examples[0]);
    for (const row of view.rows) assert.doesNotMatch(row.line, /today|yesterday|this week|\d/);
    assert.deepEqual(view.practise, { screen: 'SoundCheck', params: { missionId: 'mission:cafe' } }, 'Practise opens the newest check\'s scene');
    const unnamed = soundsView({ checks: [check({ kind: 'assessed-clear' })], now: NOW, hasJourney: true })!;
    assert.deepEqual(unnamed.rows.map((r) => [r.ipa, r.line]), [[null, SOUND_LINES.clear]]);
    assert.deepEqual(unnamed.practise, { screen: 'SoundJourney' });
  });

  test('the week in words is hidden without evidence, and its next place opens the scene preview', () => {
    assert.equal(weekView({ improvement: null, focus: null, next: null }), null);
    assert.equal(weekView({ improvement: null, focus: null, next: { missionId: 'mission:cafe', title: 'Order at a café', place: 'cafe' } }), null, 'a place to go next is not a week');
    const view = weekView({ improvement: 'You ordered at the café.', focus: null, next: { missionId: 'mission:cafe', title: 'Order at a café', place: 'cafe' } })!;
    assert.deepEqual(view.rows.map((r) => r.label), [REFLECTION_COPY.improvement, REFLECTION_COPY.next]);
    assert.deepEqual(view.rows[1]!.route, { screen: 'ScenePreview', params: { missionId: 'mission:cafe' } });
  });
});

describe('collections, the empty journey and the lock seam', () => {
  test('postcards open Postcards and badges open the badge sheet, each with its count in words', () => {
    assert.deepEqual(collectionTiles({ postcards: 1, badges: 3 }).map((t) => [t.title, t.line, t.route]), [
      ['Postcards', '1 collected', { screen: 'Postcards' }],
      ['Badges', '3 earned', { sheet: 'badges' }],
    ]);
    assert.deepEqual(collectionTiles({ postcards: 0, badges: 0 }).map((t) => t.line), ['None yet', 'None yet']);
  });

  test('before the first conversation: the empty journey starts the first scene on the spine', () => {
    const view = emptyJourney(progressOf([]));
    assert.equal(view.title, 'Your journey starts with one conversation');
    assert.equal(view.body, 'Abilities, then and now, and your phrases collect here as you talk.');
    assert.equal(view.start, 'Start Le premier café');
    assert.equal(view.missionId, 'mission:premier-cafe');
    assert.equal(isEmptyJourney(true, []), true);
    assert.equal(isEmptyJourney(true, [{ id: 'mission:cafe', at: NOW, rung: 1 }]), false, 'a scene finished with help meets "starts with one conversation"');
    assert.equal(isEmptyJourney(false, []), false);
  });

  test('every lock is the seam\'s answer: unlocked today, and each section names its own feature', () => {
    const stored: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - 3600_000, rung: 2 }];
    const deck = [card()];
    const checks = [check()];
    const reflection = { improvement: 'Well done.', focus: null, next: null };
    const asked: string[] = [];
    const spy = (feature: string) => { asked.push(feature); return 'locked' as const; };
    assert.equal(canDoView({ progress: progressOf(stored), completions: stored, now: NOW, access: spy }).locked, true);
    assert.equal(thenNowCard(stored, spy)!.locked, true);
    assert.equal(usedView({ deck, tutorName: 'Sam', now: NOW, access: spy })!.locked, true);
    assert.equal(helpView({ completions: stored, story: { sentences: [] }, now: NOW, access: spy })!.locked, true);
    assert.equal(soundsView({ checks, now: NOW, hasJourney: false, access: spy })!.locked, true);
    assert.equal(weekView(reflection, spy)!.locked, true);
    assert.deepEqual(asked, ['fullJourney', 'thenAndNow', 'fullJourney', 'fullJourney', 'sounds', 'fullJourney']);
    // 2026-10-20, lock seam wiring: with no plan read the real seam fails open.
    assert.equal(canDoView({ progress: progressOf(stored), completions: stored, now: NOW }).locked, false);
    assert.equal(thenNowCard(stored)!.locked, false);
    assert.equal(soundsView({ checks, now: NOW, hasJourney: false })!.locked, false);
  });

  test('every line is clean: no em dash, no guilt, no CEFR', () => {
    assert.equal(JOURNEY_TITLE, 'Your journey');
    for (const line of JOURNEY_COPY) {
      assert.doesNotMatch(line, /—/, line);
      assert.equal(guiltIn(line), undefined, line);
      assert.doesNotMatch(line, /\bA[012]\b|CEFR/, line);
    }
  });
});
