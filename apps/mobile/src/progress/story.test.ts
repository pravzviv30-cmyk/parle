/**
 * The weekly story — what happened, or nothing.
 *
 * Two tests in this file are the ones that matter, and neither is really about
 * strings.
 *
 * The first stands between a record of a week and an empty rail. A story that
 * renders on a quiet week has to say something about the quiet, and every
 * sentence anybody has ever written for that slot is a scold.
 *
 * The second stands between a story and a scoreboard. A week-over-week delta has
 * a down direction, and a down direction is a loss state — the streak PRODUCT.md
 * has refused twice, wearing a different hat. It is written as a property rather
 * than as two hand-picked fixtures on purpose: an example proves one prior week
 * does not leak, and the claim is that none of them can.
 *
 * The fixtures are hand-built `SessionSummary` records, which is the same choice
 * `packages/core/src/progress/progress.test.ts` makes for the same input. There
 * is no cheap way to run a real session to completion here, and every field the
 * story reads is a plain number or list rather than a state machine's output, so
 * a built fixture cannot encode an impossible history.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import type { PhonemeStat, SessionSummary, StoredSession } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { DAYS_IN_THE_STORY, MAX_STORY_SENTENCES, hasStory, storyFrom, type WeekStory } from './story.ts';

/** A local-time moment, so every boundary under test is the learner's. */
const at = (y: number, m: number, d: number, h: number, min = 0) => new Date(y, m - 1, d, h, min).getTime();

/** Noon on a Thursday. The week under test is this local day and the six before it. */
const NOON = at(2026, 8, 20, 12);

const win = (ipa: string, meanScore = 92): PhonemeStat => ({
  ipa,
  meanScore,
  sampleCount: 5,
  worstWord: 'bonjour',
  worstScore: meanScore - 6,
});

interface Spec {
  endedAt: number;
  /** Share of turns the learner composed French for themselves, 0 to 1. */
  unassistedRate?: number;
  words?: string[];
  wins?: PhonemeStat[];
}

/** One stored session, with everything the story does not read left inert. */
function session(spec: Spec): StoredSession {
  const summary: SessionSummary = {
    lessonId: 'cafe-01',
    durationSec: 300,
    pronunciation: {
      stats: [],
      focus: null,
      overall: 70,
      wins: spec.wins ?? [],
    },
    pronunciationStatus: 'scored',
    unassistedRate: spec.unassistedRate ?? 0.2,
    wordsProduced: spec.words ?? [],
    longestTurnSec: 4,
    speakingShare: 0.4,
    turnsCompleted: 10,
    rescues: 1,
    utterancesScored: 8,
    struggledTurnIds: [],
    nextStartRung: 2,
  };
  return { endedAt: spec.endedAt, summary };
}

const DAY = 24 * 60 * 60 * 1000;

/** A believable week: three sittings, mostly unaided, with words and a sound that landed. */
function goodWeek(now = NOON): StoredSession[] {
  return [
    session({ endedAt: now - 4 * DAY, unassistedRate: 0.8, words: ['bonjour', 'merci', 'café'], wins: [win('y')] }),
    session({ endedAt: now - 2 * DAY, unassistedRate: 0.7, words: ['merci', 'addition', 'sil'], wins: [win('y', 94)] }),
    session({ endedAt: now - 1 * DAY, unassistedRate: 0.9, words: ['bonjour', 'voilà'], wins: [win('ʁ', 90)] }),
  ];
}

/**
 * A deterministic generator, so a failure is a bug rather than a seed nobody
 * kept. Same arithmetic as `Math.random` promises and none of the flakiness.
 */
function rng(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x1_0000_0000;
  };
}

const VOCAB = ['bonjour', 'merci', 'café', 'addition', 'voilà', 'sil', 'oui', 'demain', 'pain', 'eau', 'table', 'carte'];
const SOUNDS = ['y', 'ʁ', 'ɛ̃', 'ø', 'ɑ̃'];

/** Sessions inside the seven local days ending at `now`. */
function randomWeek(next: () => number, now: number): StoredSession[] {
  const count = Math.floor(next() * 5);
  const out: StoredSession[] = [];
  for (let i = 0; i < count; i += 1) {
    const back = Math.floor(next() * DAYS_IN_THE_STORY);
    out.push(
      session({
        endedAt: at(2026, 8, 20 - back, 9 + Math.floor(next() * 10)),
        unassistedRate: Math.round(next() * 100) / 100,
        words: VOCAB.slice(0, Math.floor(next() * VOCAB.length)),
        wins: next() < 0.5 ? [win(SOUNDS[Math.floor(next() * SOUNDS.length)]!, 88 + Math.floor(next() * 10))] : [],
      }),
    );
  }
  void now;
  return out;
}

/** Sessions strictly before the seven local days ending at `now`. Any shape at all. */
function randomPast(next: () => number): StoredSession[] {
  const count = Math.floor(next() * 9);
  const out: StoredSession[] = [];
  for (let i = 0; i < count; i += 1) {
    const back = DAYS_IN_THE_STORY + Math.floor(next() * 60);
    out.push(
      session({
        endedAt: at(2026, 8, 20 - back, 9 + Math.floor(next() * 10)),
        // Deliberately extreme on both sides: a past week that was all
        // independence, and one that was none, are both here.
        unassistedRate: next() < 0.5 ? 1 : 0,
        words: next() < 0.5 ? VOCAB : [],
        wins: next() < 0.5 ? SOUNDS.map((s) => win(s, 99)) : [],
      }),
    );
  }
  return out;
}

/** Comments blanked, newlines kept. `motion.test.ts`'s helper, for its reason. */
function stripComments(source: string): string {
  const noBlocks = source.replace(/\/\*[\s\S]*?\*\//g, (m) => m.replace(/[^\n]/g, ' '));
  return noBlocks.replace(/(^|[^:])\/\/.*$/gm, (_m, keep: string) => keep);
}

/**
 * The module's code, not its prose.
 *
 * The header has to be free to name the boundary it is on the far side of, and
 * a scan that cannot tell a warning from a call would make explaining the rule
 * the thing that breaks it.
 */
const STORY_CODE = stripComments(readFileSync(fileURLToPath(new URL('./story.ts', import.meta.url)), 'utf8'));

/** Every sentence the story produces across a wide sweep of weeks, deduplicated. */
function everySentenceProduced(): string[] {
  const seen = new Set<string>();
  const next = rng(20260820);
  for (let i = 0; i < 400; i += 1) {
    for (const line of storyFrom(randomWeek(next, NOON), NOON).sentences) seen.add(line);
  }
  // The shapes the generator is unlikely to reach on its own.
  for (const week of [
    goodWeek(),
    [session({ endedAt: NOON - DAY, unassistedRate: 0.1 })],
    [session({ endedAt: NOON - DAY, unassistedRate: 0.1, words: ['merci'] })],
    [session({ endedAt: NOON - DAY, unassistedRate: 0.95 })],
  ]) {
    for (const line of storyFrom(week, NOON).sentences) seen.add(line);
  }
  return [...seen];
}

describe('the weekly story', () => {
  test('the weekly story says what happened this week or says nothing at all', () => {
    // Nothing at all: no history, and history that has all gone quiet. A learner
    // returning after a fortnight meets an invitation, not a report on absence.
    const nothing = storyFrom([], NOON);
    assert.deepEqual(nothing.sentences, [], 'an empty history has nothing to say');
    assert.equal(hasStory(nothing), false, 'My French must render none of it rather than an empty rail');

    const longAbsence = storyFrom(goodWeek(NOON - 30 * DAY), NOON);
    assert.deepEqual(longAbsence.sentences, [], 'a month away is not a week to narrate');
    assert.equal(hasStory(longAbsence), false);

    // And the silence is earned rather than universal: the same sessions, dated
    // inside the week, speak.
    const spoke = storyFrom(goodWeek(), NOON);
    assert.ok(hasStory(spoke), 'a week that happened has to be worth a sentence');
    assert.ok(spoke.sentences.length >= 1 && spoke.sentences.length <= MAX_STORY_SENTENCES);
    for (const line of spoke.sentences) assert.match(line, /^[A-Z].*\.$/, `not a sentence: ${line}`);

    // Any week with a session in it says something. A session that produced no
    // words and leaned on the tutor throughout is still a week that happened.
    const thin = storyFrom([session({ endedAt: NOON - DAY, unassistedRate: 0 })], NOON);
    assert.equal(thin.sentences.length, 1, 'a thin week gets one sentence, never none and never a scold');
    assert.equal(guiltIn(thin.sentences[0]!), undefined);
  });

  test('the weekly story never compares a week to the one before it', () => {
    const next = rng(7);
    let spoke = 0;
    let priorsThatWouldHaveMattered = 0;

    for (let run = 0; run < 300; run += 1) {
      const week = randomWeek(next, NOON);
      const past = randomPast(next);

      const alone: WeekStory = storyFrom(week, NOON);
      const withHistory: WeekStory = storyFrom([...past, ...week], NOON);
      assert.deepEqual(
        withHistory,
        alone,
        `a prior week changed this week's story:\n  alone: ${JSON.stringify(alone)}\n  with:  ${JSON.stringify(withHistory)}`,
      );

      // Order must not smuggle it in either.
      assert.deepEqual(storyFrom([...week, ...past], NOON), alone, 'the story depends on the order history was stored in');

      if (alone.sentences.length > 0) spoke += 1;
      // A past that any comparison would have noticed: more words, or perfect
      // independence, against a week that had neither.
      const pastWords = new Set(past.flatMap((s) => s.summary.wordsProduced)).size;
      const weekWords = new Set(week.flatMap((s) => s.summary.wordsProduced)).size;
      if (pastWords > weekWords || past.some((s) => s.summary.unassistedRate === 1)) priorsThatWouldHaveMattered += 1;
    }

    // The property is worthless if the generator only ever made empty weeks.
    assert.ok(spoke > 60, `only ${spoke} of 300 generated weeks produced a story, so the property proved little`);
    assert.ok(
      priorsThatWouldHaveMattered > 60,
      `only ${priorsThatWouldHaveMattered} of 300 runs had a prior week a comparison would have noticed`,
    );

    // The structural half: the module cannot reach a store, so there is no way
    // to fetch a prior week even if somebody wanted to.
    assert.ok(!/from '\.\/store\.ts'/.test(STORY_CODE), 'story.ts must not import the history store');
    assert.ok(!/\bawait\b|\basync\b/.test(STORY_CODE), 'story.ts must stay a pure projection of what it is handed');
  });

  test('the story leads with independence and never prints it as a number', () => {
    // This is the sentence `unassistedRate`'s comment in packages/core has been
    // promising since before there was a surface to print it on.
    const lead = storyFrom(goodWeek(), NOON).sentences[0]!;
    assert.match(lead, /on your own/, 'a mostly unaided week leads with independence');
    assert.ok(!/\d/.test(lead), `the independence lead printed a number: ${lead}`);
    assert.ok(!lead.includes('%'), 'independence is a sentence, never a rate');

    // Earned, not decorative: a week spent leaning on the tutor does not claim it.
    const helped = storyFrom(
      [
        session({ endedAt: NOON - 2 * DAY, unassistedRate: 0.2, words: ['merci'] }),
        session({ endedAt: NOON - DAY, unassistedRate: 0.1, words: ['bonjour'] }),
      ],
      NOON,
    );
    assert.ok(hasStory(helped), 'a week with help in it still happened');
    assert.ok(
      !helped.sentences.some((line) => line.includes('on your own')),
      'independence has to be earned before it is claimed',
    );

    // And the rate itself is never rendered anywhere, at any precision.
    const rates = ['0.8', '80', '0.9', '90', '70'];
    for (const line of everySentenceProduced()) {
      for (const rate of rates) {
        if (line.includes(rate)) assert.fail(`a rate reached the copy: ${line}`);
      }
    }
  });

  test('every digit in the story is a count of something the learner produced', () => {
    // today.ts bans digits outright because a number on a daily rail reads as a
    // target. This surface is read on demand and looks backwards, so a count of
    // things produced is evidence rather than a quota — but only a count, and
    // only of things produced.
    const produced = /^You used \d+ (?:different French words|French word) this week\.$/;
    for (const line of everySentenceProduced()) {
      if (!/\d/.test(line)) continue;
      assert.match(line, produced, `a digit that is not a count of words produced: ${line}`);
    }

    const words = storyFrom(goodWeek(), NOON).sentences.find((line) => produced.test(line));
    assert.equal(words, 'You used 6 different French words this week.', 'the count is the real one');

    // One word is one word, not "1 different French words".
    const single = storyFrom([session({ endedAt: NOON - DAY, words: ['merci'] })], NOON);
    assert.ok(single.sentences.includes('You used 1 French word this week.'), single.sentences.join(' | '));
  });

  test('the story carries no percentage, no day count and no weekday name', () => {
    const WEEKDAYS = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];
    for (const line of everySentenceProduced()) {
      const lower = line.toLowerCase();
      // 1. No percentage, in either notation.
      assert.ok(!line.includes('%'), `a percentage reached the copy: ${line}`);
      assert.ok(!lower.includes('percent'), `a percentage reached the copy: ${line}`);
      // 2. No day count. "Three of seven days" is the quota this surface exists
      //    to avoid, and the shortest rule that forbids it is to never say "day".
      assert.ok(!lower.includes('day'), `a day count reached the copy: ${line}`);
      assert.ok(!/\d+\s*(?:of|\/)\s*\d+/.test(line), `a quota reached the copy: ${line}`);
      // 3. No weekday name. Naming the days that happened names the ones that
      //    did not.
      for (const weekday of WEEKDAYS) {
        assert.ok(!lower.includes(weekday), `a weekday name reached the copy: ${line}`);
      }
    }
  });

  test('no sentence the story can produce carries a banned word', () => {
    const lines = everySentenceProduced();
    assert.ok(lines.length >= 4, `only ${lines.length} distinct sentences were reachable, so this checked almost nothing`);
    for (const line of lines) {
      assert.equal(guiltIn(line), undefined, `banned word in: ${line}`);
      assert.ok(!line.includes('—'), `em dash in: ${line}`);
    }
  });

  test('a sound that came out well is named, and a quiet week says nothing about sound', () => {
    const sounded = storyFrom(goodWeek(), NOON).sentences;
    assert.ok(
      sounded.some((line) => line === 'Your /y/ came out clearly this week.'),
      `the most consistent win of the week is the one named: ${sounded.join(' | ')}`,
    );

    const noWins = storyFrom([session({ endedAt: NOON - DAY, unassistedRate: 0.9, words: ['merci'] })], NOON);
    assert.ok(
      !noWins.sentences.some((line) => line.includes('came out clearly')),
      'a week with no win must not invent one',
    );
  });

  test('the story is read where the learner goes looking and cannot push itself', () => {
    // The other half of this is enforced from the reminder's side. This half
    // holds that the story never grew a way to arrive uninvited.
    for (const pushy of [/notification/i, /remind/i, /schedule/i, /expo-/i]) {
      assert.ok(!pushy.test(STORY_CODE), `story.ts mentions ${pushy}, which is how a read becomes a push`);
    }
  });

  test('a week is seven local days, not a hundred and sixty-eight hours', () => {
    // Late on the eighth local day back is under 168 hours from noon today, so
    // an implementation that subtracted hours would count it. The learner's
    // calendar says last week, and the learner's calendar is the one that runs.
    const eighthDayBack = at(2026, 8, 13, 23, 59);
    assert.ok(NOON - eighthDayBack < DAYS_IN_THE_STORY * DAY, 'the fixture only bites if it is inside 168 hours');
    assert.deepEqual(storyFrom([session({ endedAt: eighthDayBack, words: ['merci'] })], NOON).sentences, []);

    // The first minute of the seventh local day back is in, however early it is.
    const seventhDayBack = at(2026, 8, 14, 0, 1);
    assert.ok(hasStory(storyFrom([session({ endedAt: seventhDayBack, words: ['merci'] })], NOON)));

    // And a sitting later today counts for today, not for tomorrow.
    assert.ok(hasStory(storyFrom([session({ endedAt: at(2026, 8, 20, 23, 30), words: ['merci'] })], NOON)));
  });

  test('at most three sentences, however much happened', () => {
    const next = rng(99);
    for (let run = 0; run < 200; run += 1) {
      const story = storyFrom(randomWeek(next, NOON), NOON);
      assert.ok(
        story.sentences.length <= MAX_STORY_SENTENCES,
        `${story.sentences.length} sentences: a learner who sees a wall of them reads none`,
      );
      assert.equal(new Set(story.sentences).size, story.sentences.length, 'the story said the same thing twice');
    }
  });
});
