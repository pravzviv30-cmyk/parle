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
  COMING_UP_COPY,
  COMING_UP_FRESH_MS,
  TODAY_CARDS,
  todayStops,
  TODAY_COPY,
  comingUp,
  dismissComingUp,
  resetComingUpSession,
  TODAY_ROUTES,
  buildsOn,
  hidesAnswer,
  oneFix,
  questTrailing,
  sceneEyebrow,
  sceneTime,
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
  // UI-015 (founder 2026-10-30): the hour's word is back under the sky.
  test("the greeting is the hour's word, with the first name or the word alone", () => {
    const morning = new Date(2026, 0, 15, 9).getTime();
    assert.equal(homeGreeting('Yasmin', morning).title, 'Bonjour, Yasmin.');
    assert.equal(homeGreeting('  Yasmin Haddad ', morning).title, 'Bonjour, Yasmin.');
    assert.equal(homeGreeting(null, morning).title, 'Bonjour.');
    assert.equal(homeGreeting('', new Date(2026, 0, 15, 20).getTime()).title, 'Bonsoir.');
    assert.doesNotMatch(JSON.stringify(homeGreeting('Yasmin', morning)), /Bonsoir|\?/);
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
    // Founder, 2026-10-29: the card says only the scene's length, not its French name or the tutor.
    assert.match(sceneTime(sceneFor('mission:cafe')), /^About \d+ minutes?$/);
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

  // 2026-10-20 UI-008, artboard B-Today: rewritten. The founder shows Coming
  // up now (plan.md "Data slots" 2), so the page has eight blocks and the
  // Rehearse door; the countdown and the checklist are not drawn (no data).
  test('Coming up is in the page order, every door named, and no raw seconds', () => {
    // 2026-10-29 (F934, founder decision 6): the fix and the phrase are stops on Today's path.
    // UI-015: the sky (greeting and tiles) and the one hero lead it.
    assert.deepEqual([...TODAY_CARDS], ['sky', 'hero', 'path', 'three', 'comingUp', 'week']);
    assert.deepEqual({ ...TODAY_ROUTES }, { profile: 'Profile', fix: 'Drill', phrase: 'DailyPractice', week: 'WeekWrapped', rehearse: 'RealMoment', start: 'Convo' });
    assert.match(readFileSync(new URL('../profile/ProfileButton.tsx', import.meta.url), 'utf8'), /nav\.navigate\('Profile'\)/);
    assert.match(readFileSync(new URL('../daily/DailyCard.tsx', import.meta.url), 'utf8'), /nav\.navigate\('DailyPractice', \{ id: item\.id \}\)/);
    assert.match(readFileSync(new URL('../tutor/gate.ts', import.meta.url), 'utf8'), /'Convo'/);
    assert.deepEqual(heroStart(fallbackHero()).params, { missionId: SCENE_SPINE[0] });
    const source = readFileSync(new URL('./todayView.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /secondsRemaining|allowanceSeconds|periodEnd|days away/);
    for (const line of [...Object.values(TODAY_COPY), ...Object.values(COMING_UP_COPY)]) {
      assert.doesNotMatch(line, /[·—]/);
      assert.equal(guiltIn(line), undefined);
    }
  });
});

describe('Coming up, 2026-10-20 UI-008, artboard B-Today', () => {
  const open = () => 'unlocked' as const;
  const CU_NOW = Date.parse('2026-10-20T12:00:00.000Z');
  const fact = (en: string, notedAt: string, happensAround: string | null = null, kind = 'life-event') => ({ kind, en, happensAround, notedAt });

  test('shown: the latest life event, its loose when, and the tutor remembers, behind the realMoment lock its Rehearse now opens', () => {
    resetComingUpSession();
    const facts = [
      fact('dinner in Lyon', '2026-10-18T10:00:00.000Z', 'Friday'),
      fact('a job interview', '2026-10-10T10:00:00.000Z', 'Tuesday'),
      fact('cooking', '2026-10-19T10:00:00.000Z', null, 'interest'),
    ];
    const card = comingUp({ facts, paused: false, tutorName: 'Tutor', access: open, now: CU_NOW });
    assert.ok(card !== null);
    assert.equal(card.title, 'Dinner in Lyon', 'the section title says Coming up, so the line is the event alone (UI-015)');
    assert.equal(card.when, 'Friday, Tutor remembers');
    assert.doesNotMatch(card.when, /\baway\b|\bdays?\b|·/, 'a countdown is drawn with no date to count from');
    assert.equal(card.locked, false);
    // F910 (2026-10-29): the lock is the tap's, RealMoment, not tutor memory's.
    assert.equal(comingUp({ facts, paused: false, tutorName: 'Tutor', now: CU_NOW, access: (f) => (f === 'realMoment' ? 'locked' : 'unlocked') })!.locked, true);
    assert.equal(comingUp({ facts, paused: false, tutorName: 'Tutor', now: CU_NOW, access: (f) => (f === 'tutorMemory' ? 'locked' : 'unlocked') })!.locked, false);
    assert.equal(comingUp({ facts, paused: false, tutorName: 'Tutor', now: CU_NOW, access: open })!.feature, 'realMoment');

  });

  test('Rehearse now opens the real-moment builder prefilled with the event, through the realMoment lock', () => {
    resetComingUpSession();
    const card = comingUp({ facts: [fact('  dinner in Lyon ', '2026-10-18T10:00:00.000Z', 'Friday')], paused: false, tutorName: 'Tutor', access: open, now: CU_NOW })!;
    assert.deepEqual(card.route, { screen: TODAY_ROUTES.rehearse, params: { detail: 'dinner in Lyon' } });
    assert.equal(card.feature, 'realMoment');
    const screen = readFileSync(new URL('../tabs/HomeTab.tsx', import.meta.url), 'utf8').replace(/\s+/g, ' ');
    assert.match(screen, /onRehearse=\{\(\) => tapThrough\(locks\.access, event\.feature, locks\.open, \(\) => nav\.navigate\(event\.route\.screen, event\.route\.params\)\)\}/, 'Rehearse now does not go through the lock seam to RealMoment');
  });

  test('hidden: no life-event fact, a blank one, or memory paused', () => {
    resetComingUpSession();
    assert.equal(comingUp({ facts: [], paused: false, tutorName: 'A', access: open, now: CU_NOW }), null);
    assert.equal(comingUp({ facts: [fact('cooking', '2026-10-18T10:00:00.000Z', null, 'interest')], paused: false, tutorName: 'A', access: open, now: CU_NOW }), null);
    assert.equal(comingUp({ facts: [fact('   ', '2026-10-18T10:00:00.000Z')], paused: false, tutorName: 'A', access: open, now: CU_NOW }), null);
    assert.equal(comingUp({ facts: [fact('dinner', '2026-10-18T10:00:00.000Z', 'Friday')], paused: true, tutorName: 'A', access: open, now: CU_NOW }), null);
  });

  // Learning-science review, 2026-10-20: a when is loose text relative to
  // notedAt, so only a dated, fresh event is "coming up".
  test('a past or undated event hides the card, a fact older than 14 days hides it, a fresh one shows it', () => {
    resetComingUpSession();
    const ask = (f: ReturnType<typeof fact>, now = CU_NOW) => comingUp({ facts: [f], paused: false, tutorName: 'A', access: open, now });
    assert.equal(ask(fact('a wedding', '2026-10-18T10:00:00.000Z')), null, 'an event with no when, maybe past, is called coming up');
    assert.equal(ask(fact('a wedding', '2026-10-18T10:00:00.000Z', '  ')), null);
    assert.equal(ask(fact('a wedding', '2026-10-05T11:00:00.000Z', 'Friday')), null, 'a when noted over 14 days ago is still drawn');
    assert.equal(ask(fact('a wedding', 'not a date', 'Friday')), null);
    const fresh = ask(fact('a wedding', '2026-10-07T13:00:00.000Z', 'Friday'));
    assert.ok(fresh !== null, 'a fresh dated event is hidden');
    assert.equal(fresh.when, 'Friday, A remembers');
    assert.equal(COMING_UP_FRESH_MS, 14 * 24 * 60 * 60 * 1000);
  });

  test('Not now hides that event for this app session only, in memory, and a newer event still shows', () => {
    resetComingUpSession();
    const first = [fact('dinner in Lyon', '2026-10-18T10:00:00.000Z', 'Friday')];
    const card = comingUp({ facts: first, paused: false, tutorName: 'A', access: open, now: CU_NOW })!;
    dismissComingUp(card.key);
    assert.equal(comingUp({ facts: first, paused: false, tutorName: 'A', access: open, now: CU_NOW }), null, 'Not now did not hide the card');
    const newer = [...first, fact('a trip to Nice', '2026-10-19T10:00:00.000Z', 'next week')];
    assert.equal(comingUp({ facts: newer, paused: false, tutorName: 'A', access: open, now: CU_NOW })!.title, 'A trip to Nice');
    // A new app session (a fresh module state) shows it again: nothing is stored.
    resetComingUpSession();
    assert.ok(comingUp({ facts: first, paused: false, tutorName: 'A', access: open, now: CU_NOW }) !== null);
    const source = readFileSync(new URL('./todayView.ts', import.meta.url), 'utf8');
    assert.doesNotMatch(source, /AsyncStorage|SecureStore|saveJson|writeJson/, 'Not now is stored, which waits for Phase C');
  });
});

describe('One fix to try names the day, 2026-10-20 UI-008, artboard B-Today', () => {
  test('with the conversation\'s day: "Your line from {day}", and the drill carries the moment behind afterTry', () => {
    const better = 'Je peux payer par carte ?';
    const key = keyOf(better);
    const replay = { packId: 'p1', from: 'At the café', quote: 'je veux payer', better, betterEn: 'Can I pay by card?', why: 'Softer.', key, sayable: true };
    const bank: DrillExercise[] = [{ id: 't', phraseKey: key, difficulty: 'production', kind: 'translate', fr: better, en: 'Can I pay by card?', direction: 'en-fr', accepted: [better] }];
    const base = { replay, deck: [] as ReviewCard[], bank, tutorName: 'Tutor', access: () => 'unlocked' as const, now: B5_NOW };
    const yesterday = oneFix({ ...base, packs: [b5Pack({ id: 'p1', at: B5_NOW - 24 * 3_600_000 })] })!;
    assert.equal(yesterday.after, "Your line from yesterday and Tutor's version show after you try");
    assert.deepEqual(yesterday.route.params.node.moment, { quote: 'je veux payer', better, why: 'Softer.' });
    assert.equal(yesterday.route.params.node.afterTry, true, 'the moment would be drawn before the try');
    assert.equal(oneFix({ ...base, packs: [b5Pack({ id: 'p1', at: B5_NOW - 1000 })] })!.after, "Your line from today and Tutor's version show after you try");
    // No pack for the replay: Phase B's wording, and no moment.
    const unknown = oneFix({ ...base, packs: [b5Pack({ id: 'other', at: B5_NOW })] })!;
    assert.equal(unknown.after, "Tutor's version shows after you try");
    assert.ok(!('moment' in unknown.route.params.node));
    assert.doesNotMatch(yesterday.english, /je veux|Je peux/, 'the card shows the French before the try');
  });
});

describe('Today stops (UI-012, UI-015)', () => {
  test('the fix leads when there is one, otherwise the scene lead, and no stop is drawn twice', () => {
    assert.deepEqual(todayStops({ fix: true, review: true }), { hero: 'fix', rows: ['scene', 'phrase', 'review'] });
    assert.deepEqual(todayStops({ fix: true, review: false }), { hero: 'fix', rows: ['scene', 'phrase'] });
    assert.deepEqual(todayStops({ fix: false, review: true }), { hero: 'lead', rows: ['phrase', 'review'] });
    assert.deepEqual(todayStops({ fix: false, review: false }), { hero: 'lead', rows: ['phrase'] });
  });
});
