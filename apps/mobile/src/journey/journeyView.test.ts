/**
 * What the direction B Journey tab decides (2026-10-20, B4, B-Journey and the
 * Journey panel of B-Empty-States), asked of `journeyView.ts` directly: the
 * stage mapping and "You're here", the "Earn all n" count, each can-do state's
 * words, help in words only, sounds only with a saved check, the week only
 * with evidence, the lock badges only through the seam, the empty journey,
 * and every door's route.
 */

import assert from 'node:assert/strict';
import { MISSION_LEVELS } from '../scenes/scenePreview.ts';
import { describe, test } from 'node:test';
import { FRENCH_PHONEMES, MISSIONS, missionStates, spineFrom, type ReviewCard, type XpLevel } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { ledgerFrom } from '../myfrench/ledger.ts';
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
  JOURNEY_TEASERS,
  JOURNEY_TITLE,
  STAGES,
  stageIndexOf,
  STAGE_FILL,
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
  yourFrenchView,
  YOUR_FRENCH_FORWARD,
  YOUR_FRENCH_FORWARD_NO_SOUNDS,
  YOUR_FRENCH_CHIPS,
  phrasesMoreLine,
  phrasesHeldLine,
  HELD_TAG,
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
    assert.equal(stageOf({ kind: 'mission', cefr: 'A2' }), STAGES[2], 'an A2 mission is not shown as Everyday');

    const fresh = stagesFrom(progressOf([]));
    assert.equal(fresh.eyebrow, 'Starter stage');
    assert.deepEqual(fresh.steps.map((s) => s.state), ['here', 'ahead', 'ahead', 'ahead', 'ahead']);
    assert.match(fresh.steps[0]!.accessibilityLabel, new RegExp(`Stage 1, Starter, ${YOU_ARE_HERE}`));
    // 2026-10-20, sim nits: the words span the row under the ladder, one line.
    assert.equal(fresh.hereLine, `${YOU_ARE_HERE}: Starter`);

    const allA0 = stagesFrom(progressOf(A0.map((id, i) => ({ id, at: NOW - i * DAY, rung: 4 }))));
    assert.equal(allA0.eyebrow, 'Basics stage');
    assert.deepEqual(allA0.steps.map((s) => s.state), ['done', 'here', 'ahead', 'ahead', 'ahead']);
    assert.equal(allA0.hereLine, `${YOU_ARE_HERE}: Basics`);
    assert.equal(allA0.moveUp, null, 'the future stages make no claim about how to reach them');
    for (const view of [fresh, allA0]) for (const step of view.steps) assert.doesNotMatch(`${step.label} ${step.accessibilityLabel}`, /\bA[012]\b|B[12]|CEFR/);
  });

  test('every mission level has its own stage, A2 stands at Everyday and B1 at Chatting', () => {
    assert.deepEqual([...MISSION_LEVELS], ['A0', 'A1', 'A2', 'B1']);
    assert.deepEqual(MISSION_LEVELS.map(stageIndexOf), [0, 1, 2, 3]);
    assert.equal(STAGES[stageIndexOf('A2')], 'Everyday', 'an A2 learner was drawn at Basics');
    assert.equal(STAGES[stageIndexOf('B1')], 'Chatting', 'a B1 learner was drawn below Chatting');
  });

  // 2026-10-22, mission spine B1: every A0, A1 and A2 scene earned puts the spine at B1.
  test('a learner who has earned every current scene stands at Chatting', () => {
    const progress = progressOf(MISSIONS.filter((m) => m.cefr !== 'B1').map((m, i) => ({ id: m.id, at: NOW - (i + 1) * DAY, rung: 4 })));
    assert.equal(spineFrom(progress).level, 'B1');
    const here = stagesFrom(progress).steps.find((step) => step.state === 'here');
    assert.equal(here?.label, 'Chatting');
  });

  test('"Earn all n" counts the real A0 missions on the spine', () => {
    const n = startingOutMissions().length;
    assert.equal(n, A0.length);
    assert.equal(stagesFrom(progressOf([])).moveUp, `Earn all ${n} Starter abilities to move up to Basics.`);
  });

  test('the level reads "XP level n" over the total and what is left, and its bar is labelled; unread draws nothing', () => {
    // Founder decision 22 (F918): the same level name and lifetime total as Today's tile.
    const level: XpLevel = { level: 2, intoLevel: 140, levelSpan: 250, toNext: 110 };
    const view = levelHeader(level, 390)!;
    assert.equal(view.title, 'XP level 2');
    assert.equal(view.xp, '390 XP, 110 to the next');
    assert.equal(view.fraction, 140 / 250);
    assert.equal(view.barLabel, 'XP level 2, 390 XP, 110 to the next');
    assert.equal(levelHeader(null, 0), null);
  });

  test('the counts are days in a row, minutes practised (never "spoken") and phrases saved, and an unread one is left out', () => {
    // 2026-10-20, sim nits: "saved", not "kept", which overstates retention.
    assert.deepEqual(headerStats({ daysInARow: 3, minutes: 11.7, phrases: 8 }).map((s) => [s.value, s.label]), [['3', 'days in a row'], ['11', 'min practised'], ['8', 'phrases saved']]);
    assert.deepEqual(headerStats({ daysInARow: 1, minutes: null, phrases: 1 }).map((s) => [s.value, s.label]), [['1', 'day in a row'], ['1', 'phrase saved']]);
    for (const stat of headerStats({ daysInARow: 2, minutes: 3, phrases: 2 })) assert.doesNotMatch(stat.label, /\bkept\b/);
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

// 2026-10-20 UI-008, artboard B-Journey: the marks the rebuilt page draws are
// the view model's too: the track's fill, the dashed cell's words, the sound
// tiles' pastels and the week's dots.
describe('the marks B-Journey draws', () => {
  test('the stage fill is the artboard\'s 7% at Starter, a fifth more at Basics, and never goes down', () => {
    assert.equal(stagesFrom(progressOf([])).fill, STAGE_FILL);
    assert.equal(STAGE_FILL, 0.07);
    const all: StoredCompletion[] = A0.map((id, i) => ({ id, at: NOW - (i + 1) * DAY, rung: 4 }));
    const basics = stagesFrom(progressOf(all));
    assert.equal(basics.fill, STAGE_FILL + 1 / STAGES.length);
    // A tired replay at the line given does not walk the stage, or its fill, back.
    const tired = stagesFrom(progressOf([...all, ...A0.map((id) => ({ id, at: NOW, rung: 1 }))]));
    assert.ok(tired.fill >= basics.fill, 'the track went backwards');
  });

  test('the then and now card says the dashed line only while there is no best', () => {
    assert.equal(thenNowCard([{ id: 'mission:cafe', at: NOW, rung: 2 }])!.hint, 'Try again to see your best here');
    assert.equal(thenNowCard([{ id: 'mission:cafe', at: NOW - DAY, rung: 2 }, { id: 'mission:cafe', at: NOW, rung: 4 }])!.hint, null);
  });

  test('sound tiles alternate peach and lavender, and the week\'s dots are mint, sun and brand', () => {
    const [first, second] = FRENCH_PHONEMES;
    const sounds = soundsView({ checks: [check({ phoneme: first!.ipa, at: NOW - 2 * DAY }), check({ phoneme: second!.ipa, at: NOW - DAY })], now: NOW, hasJourney: false })!;
    assert.deepEqual(sounds.rows.map((r) => r.tile), ['peach', 'lavender']);
    const week = weekView({ improvement: 'You ordered at the café.', focus: 'le or la before a noun.', next: { missionId: 'mission:cafe', title: 'Order at a café', place: 'cafe' } })!;
    assert.deepEqual(week.rows.map((r) => r.dot), ['mint', 'sun', 'brand']);
  });
});

describe('french used, help needed, sounds and the week', () => {
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
    assert.equal(yourFrenchView({ deck, checks: [], progress: [], now: NOW, access: spy }).phrases!.locked, true);
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

// 2026-10-22: the empty Journey's one start is the scene the goal picks.
test('the empty journey starts on the goal scene and says it was picked for it', () => {
  const fresh = emptyJourney(missionStates([], [], 0), 'family');
  assert.equal(fresh.missionId, 'mission:premier-cafe', 'a brand-new learner starts on the opener');
  assert.equal(fresh.picked, null);
  const opened = missionStates([{ id: 'mission:premier-cafe', at: 1, rung: 4 }], [], 2);
  const start = emptyJourney(opened, 'family');
  assert.equal(start.missionId, 'mission:amis');
  assert.equal(start.picked, 'Picked for talking with family');
  assert.doesNotMatch(start.body, /^Picked for/, 'the goal line is the eyebrow, not the body');
  const plain = emptyJourney(opened, null);
  assert.equal(plain.picked, null);
});

// 2026-10-22: Your French, the learner's own French first on Journey.
describe('your french: each part only with saved evidence behind it', () => {
  const IPA = FRENCH_PHONEMES[0]!.ipa;
  const focus = (at: number, reference = 'Bonjour', missionId = 'mission:cafe'): SoundCheckEvidence => check({ at, reference, missionId, kind: 'assessed-focus', phoneme: IPA, focus: null });
  const clear = (at: number, reference = 'Bonjour', missionId = 'mission:cafe'): SoundCheckEvidence => check({ at, reference, missionId, kind: 'assessed-clear' });
  const base = { checks: [] as SoundCheckEvidence[], progress: progressOf([]), now: NOW };
  const lines = (v: ReturnType<typeof yourFrenchView>): string[] => [
    v.heading, v.forward, v.phrases?.usedLine, v.phrases?.heldLine, v.phrases?.moreLine, v.phrases?.accessibilityLabel,
    v.sounds?.line ? segmentsText(v.sounds.line) : null, v.sounds?.accessibilityLabel, v.scenes?.line, v.scenes?.accessibilityLabel,
  ].filter((x): x is string => typeof x === 'string');

  test('phrases come only from conversation use, and held counts only among them', () => {
    const none = yourFrenchView({ ...base, deck: [card({ evidence: { retrievals: 4, convoUses: 0, transfers: 3 } })] });
    assert.equal(none.phrases, null, 'a transfer without conversation use is not a used phrase');
    const deck = [
      card({ id: 'a', front: 'je voudrais un café', addedAt: NOW - 3 * DAY, evidence: { retrievals: 1, convoUses: 2, transfers: 1 } }),
      card({ id: 'b', front: 'merci beaucoup', addedAt: NOW - 1 * DAY, evidence: { retrievals: 1, convoUses: 5, transfers: 0 } }),
      card({ id: 'c', front: 'jamais dit', evidence: { retrievals: 4, convoUses: 0, transfers: 2 } }),
    ];
    const p = yourFrenchView({ ...base, deck }).phrases!;
    assert.equal(p.usedLine, '2 phrases used in conversation');
    assert.equal(p.heldLine, '1 held up when the situation changed');
    const ledger = ledgerFrom({ deck, now: NOW });
    assert.deepEqual(p.featured, { front: ledger.featured!.front, held: ledger.featured!.id === 'a' }, 'the featured phrase is the ledger\'s, the one Phrasebook and Home feature');
    assert.deepEqual(p.chips, ledger.rows.slice(0, YOUR_FRENCH_CHIPS).map((r) => ({ front: r.front, held: r.id === 'a' })), 'chips are the ledger rows in ledger order');
    assert.equal(p.moreLine, null, 'everything is drawn, so no more line');
    assert.deepEqual(p.route, { screen: 'Phrasebook' });
    assert.equal(p.accessibilityLabel, '2 phrases used in conversation. 1 held up when the situation changed. Opens your phrasebook', 'English only, no French list');
    const one = yourFrenchView({ ...base, deck: [deck[1]!] }).phrases!;
    assert.equal(one.usedLine, '1 phrase used in conversation');
    assert.equal(one.heldLine, null, 'no held line at zero');
    assert.deepEqual(one.featured, { front: 'merci beaucoup', held: false });
    assert.equal(one.accessibilityLabel, '1 phrase used in conversation. Opens your phrasebook');
  });

  test('the count matches what is drawn: the rest are "n more in your phrasebook"', () => {
    const many = Array.from({ length: 9 }, (_, i) => card({ id: `p${i}`, front: `phrase ${i}`, addedAt: NOW - (i + 1) * DAY, evidence: { retrievals: 1, convoUses: 1, transfers: 0 } }));
    const p = yourFrenchView({ ...base, deck: many }).phrases!;
    assert.equal(p.chips.length, YOUR_FRENCH_CHIPS);
    assert.equal(p.moreLine, 'and 3 more in your phrasebook');
    assert.equal(p.accessibilityLabel, '9 phrases used in conversation. and 3 more in your phrasebook. Opens your phrasebook');
    const seven = yourFrenchView({ ...base, deck: many.slice(0, 7) }).phrases!;
    assert.equal(seven.moreLine, 'and 1 more in your phrasebook');
    assert.equal(phrasesMoreLine(1), 'and 1 more in your phrasebook');
    assert.doesNotMatch(phrasesHeldLine(2), /\bthese\b/i, 'the held line never says "these"');
  });

  test('sounds come only from a called-out line that later came back clear', () => {
    assert.equal(yourFrenchView({ ...base, deck: [], checks: [clear(NOW - 3 * DAY), clear(NOW - DAY)] }).sounds, null, 'clear checks alone are not a sound coming back');
    assert.equal(yourFrenchView({ ...base, deck: [], checks: [focus(NOW - 3 * DAY), focus(NOW - DAY)] }).sounds, null);
    const s = yourFrenchView({ ...base, deck: [], checks: [focus(NOW - 3 * DAY), clear(NOW - DAY)] }).sounds!;
    assert.equal(segmentsText(s.line!), 'A line from Au café du coin that was called out came back clear.');
    assert.ok(s.line!.some((seg) => seg.fr === true && seg.text === 'Au café du coin'), 'the scene title is tagged French');
    assert.deepEqual(s.route, { screen: 'SoundJourney' });
    const again = yourFrenchView({ ...base, deck: [], checks: [focus(NOW - 3 * DAY), clear(NOW - 2 * DAY), focus(NOW - DAY)] });
    assert.equal(again.sounds, null, 'a later call-out takes the clear line back');
    const two = yourFrenchView({ ...base, deck: [], checks: [focus(NOW - 4 * DAY), clear(NOW - 3 * DAY), focus(NOW - 3 * DAY, 'Merci'), clear(NOW - DAY, 'Merci')] }).sounds!;
    assert.equal(segmentsText(two.line!), '2 lines that were called out came back clear, most recently in Au café du coin.');
  });

  test('scenes are the earned ones only, newest first; a helped finish does not count', () => {
    const helped: StoredCompletion[] = [{ id: 'mission:cafe', at: NOW - DAY, rung: 2 }];
    assert.equal(yourFrenchView({ ...base, deck: [], progress: progressOf(helped), completions: helped }).scenes, null);
    const own: StoredCompletion[] = [{ id: A0[0]!, at: NOW - 3 * DAY, rung: 4 }, { id: A0[1]!, at: NOW - DAY, rung: 4 }];
    const sc = yourFrenchView({ ...base, deck: [], progress: progressOf(own), completions: own }).scenes!;
    assert.match(sc.line, /^\d+ scenes? earned on your own$/);
    assert.equal(sc.titles[0], MISSIONS.find((m) => m.id === A0[1])!.title, 'the newest earned scene leads');
    assert.ok(sc.titles.length <= 3);
    assert.deepEqual(sc.route, { screen: 'Postcards' });
  });

  test('a practised learner with no evidence yet reads the forward line, with no numeral', () => {
    const v = yourFrenchView({ ...base, deck: [card({ evidence: { retrievals: 1, convoUses: 0, transfers: 0 } })] });
    assert.equal(v.forward, YOUR_FRENCH_FORWARD);
    assert.deepEqual(v.open, []);
    assert.doesNotMatch(v.forward!, /\d/);
    assert.equal(yourFrenchView({ ...base, deck: [card()] }).forward, null);
    const soundsLocked = yourFrenchView({ ...base, deck: [card({ evidence: { retrievals: 1, convoUses: 0, transfers: 0 } })], access: (f: string) => (f === 'sounds' ? 'locked' as const : 'unlocked' as const) });
    assert.equal(soundsLocked.forward, YOUR_FRENCH_FORWARD_NO_SOUNDS, 'a locked sounds part drops the sounds clause');
    assert.doesNotMatch(YOUR_FRENCH_FORWARD_NO_SOUNDS, /sound/);
  });

  test('locks stay as they were: phrases and their counts behind fullJourney, sounds behind sounds, scenes free', () => {
    const deck = [card({ evidence: { retrievals: 1, convoUses: 1, transfers: 1 } })];
    const checks = [focus(NOW - 3 * DAY), clear(NOW - DAY)];
    const own: StoredCompletion[] = [{ id: A0[0]!, at: NOW - DAY, rung: 4 }];
    const all = (feature: string) => (feature === 'fullJourney' || feature === 'sounds' ? 'locked' as const : 'unlocked' as const);
    const v = yourFrenchView({ deck, checks, progress: progressOf(own), completions: own, now: NOW, access: all });
    assert.equal(v.phrases!.usedLine, null);
    assert.equal(v.phrases!.heldLine, null);
    assert.equal(v.phrases!.featured, null);
    assert.deepEqual(v.phrases!.chips, []);
    assert.equal(v.phrases!.teaser, JOURNEY_TEASERS.used);
    assert.doesNotMatch(v.phrases!.accessibilityLabel, /croissant|\d/);
    assert.equal(v.sounds!.line, null);
    assert.equal(v.sounds!.teaser, JOURNEY_TEASERS.sounds);
    assert.notEqual(v.scenes, null);
    assert.deepEqual(v.open, ['scenes']);
  });

  test('every line is a count of records in plain words: no guilt, em dash, percent, score or ladder word', () => {
    const deck = [card({ evidence: { retrievals: 1, convoUses: 1, transfers: 1 } }), card({ id: 'b', front: 'merci', evidence: { retrievals: 1, convoUses: 3, transfers: 0 } })];
    const own: StoredCompletion[] = [{ id: A0[0]!, at: NOW - DAY, rung: 4 }];
    const views = [
      yourFrenchView({ deck, checks: [focus(NOW - 3 * DAY), clear(NOW - DAY)], progress: progressOf(own), completions: own, now: NOW }),
      yourFrenchView({ deck: [card({ evidence: { retrievals: 1, convoUses: 0, transfers: 0 } })], checks: [], progress: progressOf([]), now: NOW }),
    ];
    const said = [...views.flatMap(lines), HELD_TAG, YOUR_FRENCH_FORWARD, YOUR_FRENCH_FORWARD_NO_SOUNDS, phrasesMoreLine(1), phrasesMoreLine(4)];
    for (const line of said) {
      assert.doesNotMatch(line, /—/, line);
      assert.equal(guiltIn(line), undefined, line);
      assert.doesNotMatch(line, /%|mastered|fluent|score|of \d|line given|choices|hint/i, line);
    }
    for (const line of [YOUR_FRENCH_FORWARD, YOUR_FRENCH_FORWARD_NO_SOUNDS, HELD_TAG, phrasesMoreLine(1)]) assert.ok(JOURNEY_COPY.includes(line), line);
  });
});
