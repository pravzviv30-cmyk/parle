/**
 * What Today draws under the scene brief — notebook Phase 3, B1 (2026-09-27).
 *
 * Two blocks, each drawn only when it has something true to show. On day one,
 * "Where you're starting": A0 and the first three can-dos in spine order. After
 * that, two plain sentences about the week, and nothing at all on a quiet week.
 * The four empty tiles and the seven-dot rail they replace are gone.
 */

import assert from 'node:assert/strict';
import { describe, test } from 'node:test';
import { SCENE_SPINE, getMission, missionStates } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { STARTING_LABEL, WEEK_LINES_MAX, startingPoint, weekLines } from './todayView.ts';

const NOW = new Date(2026, 8, 12, 21, 0, 0).getTime();

describe('where you are starting', () => {
  test('day one shows A0 and the first three can-dos in spine order', () => {
    const start = startingPoint(missionStates([], [], NOW));
    assert.ok(start !== null, 'a learner with nothing behind them is not shown where they are starting');
    // 2026-10-20, B5 learning-science review: no CEFR level on day one.
    assert.ok(!('level' in start), 'day one carries a CEFR level');
    assert.deepEqual(
      start.canDos,
      SCENE_SPINE.slice(0, 3).map((id) => getMission(id)!.canDoEn),
      'the three can-dos are not the first three on the spine',
    );
    assert.deepEqual(start.canDos, ['Order a coffee at the counter', 'Order food and drink, then pay', 'Check in and ask one question']);
    assert.equal(STARTING_LABEL, "Where you're starting");
  });

  test('the block leaves once any scene has been finished, earned or not', () => {
    const finished = missionStates([{ id: 'mission:premier-cafe', at: NOW - 1000, rung: 1 }], [], NOW);
    assert.equal(startingPoint(finished), null, 'a learner who has finished a scene is still told where they are starting');
    assert.equal(startingPoint([]), null, 'an unread progress list is treated as day one');
  });
});

describe('two plain sentences about the week', () => {
  test('at most two, the reflection first, never repeated, and none on a quiet week', () => {
    assert.equal(WEEK_LINES_MAX, 2);
    assert.deepEqual(weekLines({ story: { sentences: [] }, reflection: null }), [], 'a quiet week says something');
    assert.deepEqual(
      weekLines({ story: { sentences: [] }, reflection: { improvement: null, focus: null, next: null } }),
      [],
      'an empty reflection is drawn as a sentence',
    );
    const story = { sentences: ['You had three conversations this week.', 'This week you mostly found the words on your own.', 'You said forty different French words.'] };
    assert.deepEqual(weekLines({ story, reflection: null }), story.sentences.slice(0, 2));
    assert.deepEqual(
      weekLines({ story, reflection: { improvement: 'This week you mostly found the words on your own.', focus: null, next: null } }),
      ['This week you mostly found the words on your own.', 'You had three conversations this week.'],
      'the reflection does not lead, or a sentence is said twice',
    );
    // The focus can be a bare French correction, which is not a sentence about the week.
    assert.deepEqual(weekLines({ story: { sentences: [] }, reflection: { improvement: null, focus: 'Je voudrais', next: null } }), []);
    for (const line of weekLines({ story, reflection: null })) {
      assert.equal(guiltIn(line), undefined);
    }
  });
});

/* 2026-10-20, B5, B-Today: the page's view model. */
import { buildConversationPack, phraseKeyOf as keyOf, type ConversationPack, type DrillExercise, type ReviewCard } from '@luvani/core';
import { homeGreeting } from './greeting.ts';
import { fallbackHero, heroStart, homeMissionFrom, type HomeMission } from './homeMission.ts';
import {
  TODAY_CARDS,
  TODAY_COPY,
  TODAY_ROUTES,
  buildsOn,
  hidesAnswer,
  oneFix,
  questTrailing,
  sceneEyebrow,
  sceneLine,
  threeDone,
  weekInFrench,
  weekStart,
} from './todayView.ts';
import { readFileSync } from 'node:fs';

const B5_NOW = new Date(2026, 9, 20, 14, 0, 0).getTime();

function b5Pack(input: { id: string; at: number; phrases?: readonly string[]; corrections?: boolean; durationSec?: number | null }): ConversationPack {
  const built = buildConversationPack({
    id: input.id, sessionId: input.id, learnerId: 'l', createdAt: new Date(input.at).toISOString(),
    title: { fr: 'Au café', en: 'At the café' }, summary: 's',
    keyPhrases: (input.phrases ?? ['Bonne soirée']).map((fr) => ({ fr, frWritten: null, en: 'x' })),
    corrections: input.corrections === false ? [] : [{ quote: 'je veux payer', better: 'Je peux payer par carte ?', betterEn: 'Can I pay by card?', why: 'Softer.' }],
  });
  return { ...built, durationSec: input.durationSec ?? null };
}

const sceneFor = (id: string): HomeMission => {
  const progress = missionStates([], [], B5_NOW);
  const hero = homeMissionFrom({ progress, records: [], levelIndex: 0, startingMissionId: id as never, now: B5_NOW });
  assert.ok(hero !== null && hero.kind === 'scene');
  return hero;
};

describe('Today, B-Today (2026-10-20, B5)', () => {
  test('the greeting is always Bonjour, with the first name or the word alone', () => {
    assert.equal(homeGreeting('Yasmin').title, 'Bonjour, Yasmin.');
    assert.equal(homeGreeting('  Yasmin Haddad ').title, 'Bonjour, Yasmin.');
    assert.equal(homeGreeting(null).title, 'Bonjour.');
    assert.equal(homeGreeting('').title, 'Bonjour.');
    assert.doesNotMatch(JSON.stringify(homeGreeting('Yasmin')), /Bonsoir|\?/);
  });

  test('the eyebrow is the scene place in its stage, with commas', () => {
    const a0 = SCENE_SPINE.map((id) => getMission(id)!).filter((m) => m.cefr === 'A0');
    assert.equal(sceneEyebrow(sceneFor('mission:premier-cafe')), `Next scene, 1 of ${a0.length}`);
    assert.equal(sceneEyebrow(sceneFor('mission:cafe')), `Next scene, 2 of ${a0.length}`);
    const a1 = SCENE_SPINE.map((id) => getMission(id)!).filter((m) => m.cefr === 'A1');
    const firstA1 = a1[0]!;
    assert.equal(sceneEyebrow(sceneFor(firstA1.id)), `Next scene, 1 of ${a1.length}`);
    assert.equal(sceneEyebrow({ ...sceneFor('mission:cafe'), label: 'Pick up where you left off' }), 'Pick up where you left off');
    for (const id of SCENE_SPINE) assert.doesNotMatch(sceneEyebrow(sceneFor(id)), /[·—]/);
    const line = sceneLine(sceneFor('mission:cafe'), 'Tutor');
    assert.equal(line.french, getMission('mission:cafe')!.title);
    assert.match(line.rest, /^, about \d+ min with Tutor$/);
  });

  test('"Builds on" only when the last conversation really meets the scene', () => {
    const cafe = sceneFor('mission:cafe');
    const meets = b5Pack({ id: 'p1', at: B5_NOW - 1000, phrases: ['Bonne soirée', 'je peux payer par carte'] });
    assert.equal(buildsOn([meets], cafe), 'je peux payer par carte', 'a real meeting, punctuation and case aside, is not found');
    assert.equal(buildsOn([b5Pack({ id: 'p2', at: B5_NOW - 1000, phrases: ['Bonne soirée'] })], cafe), null, 'a chip is drawn with no meeting');
    // Only the newest conversation counts: an older one that met it says nothing.
    assert.equal(buildsOn([meets, b5Pack({ id: 'p3', at: B5_NOW, phrases: ['Bonne soirée'] })], cafe), null);
    assert.equal(buildsOn([], cafe), null);
    assert.equal(buildsOn([meets], null), null);
  });

  test('the three: "n of 3 done", and XP while waiting or done, the count while moving', () => {
    assert.equal(threeDone(1), '1 of 3 done');
    assert.equal(threeDone(7), '3 of 3 done');
    assert.equal(threeDone(-1), '0 of 3 done');
    assert.deepEqual(questTrailing({ complete: true, done: 1, target: 1, count: 'Done' }), { kind: 'xp', label: '+10 XP', earned: true });
    assert.deepEqual(questTrailing({ complete: false, done: 6, target: 10, count: '6 of 10' }), { kind: 'count', label: '6 of 10' });
    assert.deepEqual(questTrailing({ complete: false, done: 0, target: 1, count: '0 of 1' }), { kind: 'xp', label: '+10 XP', earned: false });
  });

  test('one fix to try: present only when the drill would ask for the French without showing it, attempt first, behind the seam', () => {
    const better = 'Je peux payer par carte ?';
    const key = keyOf(better);
    const replay = { packId: 'p1', from: 'At the café', quote: 'je veux payer', better, betterEn: 'Can I pay by card?', why: 'Softer.', key, sayable: true };
    const translate = (direction: 'en-fr' | 'fr-en'): DrillExercise => ({ id: `t:${direction}`, phraseKey: key, difficulty: 'production', kind: 'translate', fr: better, en: 'Can I pay by card?', direction, accepted: [better] });
    const repeat: DrillExercise = { id: 'r', phraseKey: key, difficulty: 'production', kind: 'repeat-this', reference: better, referenceEn: 'x', ipa: null, noMicTwin: translate('en-fr') };
    const tiles: DrillExercise = { id: 'tiles', phraseKey: key, difficulty: 'recognition', kind: 'tap-translate', en: 'x', tokens: better.split(' '), accepted: [better] } as DrillExercise;
    const choice: DrillExercise = { id: 'mc', phraseKey: key, difficulty: 'recognition', kind: 'best-sentence', prompt: 'x', candidates: [{ fr: better, en: 'x' }], correctIndex: 0 } as DrillExercise;
    // The bank a real pack leaves for its repair: a typed translation and a line to repeat.
    const bank = [translate('en-fr'), repeat];
    const open = () => 'unlocked' as const;
    const base = { replay, deck: [] as ReviewCard[], bank, tutorName: 'Tutor', access: open, now: B5_NOW };
    const fix = oneFix(base);
    assert.ok(fix !== null, 'a new repair, opened on its typed translation, is not offered');
    assert.equal(fix.english, 'Can I pay by card?');
    assert.equal(fix.after, "Tutor's version shows after you try", 'the card promises a line the drill never shows');
    assert.doesNotMatch(JSON.stringify(fix), /je veux payer|Je peux payer|Softer|Your line/);
    assert.deepEqual(fix.route, { screen: TODAY_ROUTES.fix, params: { node: { id: `fix:p1:${key}`, title: TODAY_COPY.fix, phraseKeys: [key] } } });
    assert.ok(!('moment' in fix.route.params.node), 'the drill opens with the answer drawn above it');
    assert.equal(fix.feature, 'fixes');
    assert.equal(fix.locked, false);
    assert.equal(oneFix({ ...base, access: () => 'locked' })!.locked, true);

    // The answer stays hidden until a try: an exercise that shows or plays the
    // French first is never what the card opens on.
    assert.equal(hidesAnswer(translate('en-fr')), true);
    assert.equal(hidesAnswer(translate('fr-en')), false);
    assert.equal(hidesAnswer(repeat), false);
    assert.equal(hidesAnswer(tiles), false);
    assert.equal(hidesAnswer(choice), false);
    assert.equal(hidesAnswer({ id: 'lt', phraseKey: key, difficulty: 'production', kind: 'listen-type', fr: better, accepted: [better] } as DrillExercise), false);
    assert.equal(hidesAnswer({ id: 'fb', phraseKey: key, difficulty: 'production', kind: 'fill-blank', sentence: '___', options: null, accepted: ['x'], en: 'x' } as DrillExercise), true);
    assert.equal(hidesAnswer({ id: 'fb2', phraseKey: key, difficulty: 'recognition', kind: 'fill-blank', sentence: '___', options: ['x', 'y'], accepted: ['x'], en: 'x' } as DrillExercise), false);
    assert.equal(oneFix({ ...base, bank: [choice] }), null, 'a fix opens on multiple choice');
    assert.equal(oneFix({ ...base, bank: [tiles, repeat] }), null, 'a fix opens on word tiles');
    // A practised card is drilled at its spoken stage, the line to repeat: hidden.
    const practised: ReviewCard = { id: key, kind: 'turn', front: better, back: 'x', context: '', ipa: '', addedAt: B5_NOW - 9e8, due: B5_NOW - 1, intervalDays: 4, ease: 2.5, reps: 3, lapses: 0 };
    assert.equal(oneFix({ ...base, deck: [practised] }), null, 'a fix opens on the line to repeat, which shows the French');

    assert.equal(oneFix({ ...base, replay: null }), null, 'a fix is drawn with no replay');
    assert.equal(oneFix({ ...base, replay: { ...replay, sayable: false } }), null, 'a fix opens an empty sitting');
    assert.equal(oneFix({ ...base, bank: [] }), null, 'a fix opens a drill with nothing in it');
  });

  test('the week sums exactly seven local days, and is absent with no evidence', () => {
    const start = weekStart(B5_NOW);
    assert.equal(new Date(start).getHours(), 0);
    assert.equal(new Date(start).getDate(), new Date(B5_NOW).getDate() - 6, 'the window is not today and the six local days before it');
    const card = (at: number): ReviewCard => ({ id: `c${at}`, kind: 'turn', front: 'x', back: 'x', context: '', ipa: '', addedAt: at, due: at, intervalDays: 1, ease: 2.5, reps: 0, lapses: 0 });
    const packs = [
      b5Pack({ id: 'in', at: start, durationSec: 360 }),
      b5Pack({ id: 'in2', at: B5_NOW - 1000, durationSec: 300 }),
      b5Pack({ id: 'out', at: start - 1, durationSec: 6000 }),
      b5Pack({ id: 'none', at: B5_NOW, durationSec: null }),
    ];
    assert.equal(weekInFrench({ packs, deck: [card(start), card(B5_NOW), card(start - 1)], now: B5_NOW }), '11 minutes practised, 2 phrases saved');
    assert.equal(weekInFrench({ packs: [packs[2]!], deck: [card(start - 1)], now: B5_NOW }), null, 'a week with no evidence draws a card');
    assert.equal(weekInFrench({ packs: [], deck: [card(B5_NOW)], now: B5_NOW }), '1 phrase saved');
    assert.equal(weekInFrench({ packs: [b5Pack({ id: 'x', at: B5_NOW, durationSec: 59 })], deck: [], now: B5_NOW }), null, 'under a minute is drawn as a minute');
  });

  test('no Coming up card, every door named, and no raw seconds', () => {
    assert.deepEqual([...TODAY_CARDS], ['greeting', 'stats', 'nextScene', 'three', 'fix', 'phrase', 'week']);
    assert.ok(!(TODAY_CARDS as readonly string[]).includes('comingUp'));
    assert.deepEqual({ ...TODAY_ROUTES }, { profile: 'Profile', fix: 'Drill', phrase: 'DailyPractice', week: 'WeekWrapped', start: 'Convo' });
    assert.match(readFileSync(new URL('../profile/ProfileButton.tsx', import.meta.url), 'utf8'), /nav\.navigate\('Profile'\)/);
    assert.match(readFileSync(new URL('../daily/DailyCard.tsx', import.meta.url), 'utf8'), /nav\.navigate\('DailyPractice', \{ id: item\.id \}\)/);
    assert.match(readFileSync(new URL('../tutor/gate.ts', import.meta.url), 'utf8'), /'Convo'/);
    assert.deepEqual(heroStart(fallbackHero()).params, { missionId: SCENE_SPINE[0] });
    const source = readFileSync(new URL('./todayView.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /secondsRemaining|allowanceSeconds|periodEnd/);
    for (const line of Object.values(TODAY_COPY)) {
      assert.doesNotMatch(line, /[·—]|Coming up/);
      assert.equal(guiltIn(line), undefined);
    }
  });
});
