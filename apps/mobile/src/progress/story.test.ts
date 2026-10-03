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
import { buildConversationPack, type ConversationPack, type PhonemeStat, type SessionSummary, type StoredSession } from '@luvani/core';

import { guiltIn } from '../copy/guilt.ts';
import { DAYS_IN_THE_STORY, MAX_STORY_SENTENCES, hasStory, storyFrom, type StoryInput, type WeekStory } from './story.ts';

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

/** The other three inputs, absent, so the session-only tests read as they did. */
const NONE: Omit<StoryInput, 'sessions' | 'now'> = { activity: [], packs: [], completions: [] };

/** The story of these sessions and nothing else, at noon. */
function story(sessions: readonly StoredSession[], over: Partial<Omit<StoryInput, 'now'>> = {}): WeekStory {
  return storyFrom({ sessions, ...NONE, ...over, now: NOON });
}

/** A pack made at `createdAt`, opening on `topics`. Everything else inert. */
function pack(createdAt: number, topics: readonly string[], id = `pack-${createdAt}`): ConversationPack {
  return buildConversationPack({
    id, sessionId: id, learnerId: 'l', createdAt: new Date(createdAt).toISOString(),
    title: { fr: 'Le café', en: 'The café' }, summary: 'You ordered.',
    keyPhrases: [{ fr: 'Un café, s’il vous plaît', frWritten: null, en: 'A coffee, please' }],
    topics: topics.map((en) => ({ fr: en, en })),
  });
}

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

/** A local moment `back` days behind the story's last day plus up to sixty more, or inside the week. */
function randomMoment(next: () => number, floor: number): number {
  const back = floor === 0 ? Math.floor(next() * DAYS_IN_THE_STORY) : floor + Math.floor(next() * 60);
  return at(2026, 8, 20 - back, 9 + Math.floor(next() * 10));
}

/** Sittings of any kind, inside the week (`floor` 0) or strictly before it. */
function randomActivity(next: () => number, floor: number): { at: number }[] {
  const count = Math.floor(next() * 5);
  return Array.from({ length: count }, () => ({ at: randomMoment(next, floor) }));
}

const TOPICS = ['Ordering coffee', 'The weather', 'Your 3 cats', 'Breakfast plans', 'Asking for the bill', 'Monday mornings', 'Paris'];

/** Conversation packs, inside the week or strictly before it, with topics of every shape. */
function randomPacks(next: () => number, floor: number): ConversationPack[] {
  const count = Math.floor(next() * 3);
  return Array.from({ length: count }, (_, i) => {
    const when = randomMoment(next, floor);
    const topics = TOPICS.filter(() => next() < 0.5);
    return pack(when, topics, `pack-${floor}-${i}-${when}`);
  });
}

const MISSION_IDS = ['mission:cafe', 'mission:hotel', 'mission:marche', 'mission:chemin', 'mission:journee', 'mission:amis', 'mission:gone'];

/** Finished missions, inside the week or strictly before it. */
function randomCompletions(next: () => number, floor: number): { id: string; at: number }[] {
  const count = Math.floor(next() * 4);
  return Array.from({ length: count }, () => ({
    id: MISSION_IDS[Math.floor(next() * MISSION_IDS.length)]!,
    at: randomMoment(next, floor),
  }));
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
    const rest = { activity: randomActivity(next, 0), packs: randomPacks(next, 0), completions: randomCompletions(next, 0) };
    for (const line of story(randomWeek(next, NOON), rest).sentences) seen.add(line);
  }
  // The shapes the generator is unlikely to reach on its own.
  for (const week of [
    goodWeek(),
    [session({ endedAt: NOON - DAY, unassistedRate: 0.1 })],
    [session({ endedAt: NOON - DAY, unassistedRate: 0.1, words: ['merci'] })],
    [session({ endedAt: NOON - DAY, unassistedRate: 0.95 })],
  ]) {
    for (const line of story(week).sentences) seen.add(line);
  }
  return [...seen];
}

describe('the weekly story', () => {
  test('the weekly story says what happened this week or says nothing at all', () => {
    // Nothing at all: no history, and history that has all gone quiet. A learner
    // returning after a fortnight meets an invitation, not a report on absence.
    const nothing = story([]);
    assert.deepEqual(nothing.sentences, [], 'an empty history has nothing to say');
    assert.equal(hasStory(nothing), false, 'My French must render none of it rather than an empty rail');

    const longAbsence = story(goodWeek(NOON - 30 * DAY));
    assert.deepEqual(longAbsence.sentences, [], 'a month away is not a week to narrate');
    assert.equal(hasStory(longAbsence), false);

    // And the silence is earned rather than universal: the same sessions, dated
    // inside the week, speak.
    const spoke = story(goodWeek());
    assert.ok(hasStory(spoke), 'a week that happened has to be worth a sentence');
    assert.ok(spoke.sentences.length >= 1 && spoke.sentences.length <= MAX_STORY_SENTENCES);
    for (const line of spoke.sentences) assert.match(line, /^[A-Z].*\.$/, `not a sentence: ${line}`);

    // Any week with a session in it says something. A session that produced no
    // words and leaned on the tutor throughout is still a week that happened.
    const thin = story([session({ endedAt: NOON - DAY, unassistedRate: 0 })]);
    assert.equal(thin.sentences.length, 1, 'a thin week gets one sentence, never none and never a scold');
    assert.equal(hasStory(thin), false, 'an activity-only week does not become an achievement story');
    assert.equal(guiltIn(thin.sentences[0]!), undefined);
  });

  test('the weekly story never compares a week to the one before it', () => {
    const next = rng(7);
    let spoke = 0;
    let priorsThatWouldHaveMattered = 0;

    for (let run = 0; run < 300; run += 1) {
      const week = randomWeek(next, NOON);
      const past = randomPast(next);
      // The other three inputs the story reads now, each with its own week
      // and its own past. The property is the same for all four: a prior
      // week, of any shape, leaves this week's sentences byte for byte the same.
      const rest = {
        activity: randomActivity(next, 0),
        packs: randomPacks(next, 0),
        completions: randomCompletions(next, 0),
      };
      const restPast = {
        activity: randomActivity(next, DAYS_IN_THE_STORY),
        packs: randomPacks(next, DAYS_IN_THE_STORY),
        completions: randomCompletions(next, DAYS_IN_THE_STORY),
      };

      const alone: WeekStory = story(week, rest);
      const withHistory: WeekStory = story([...past, ...week], {
        activity: [...restPast.activity, ...rest.activity],
        packs: [...restPast.packs, ...rest.packs],
        completions: [...restPast.completions, ...rest.completions],
      });
      assert.deepEqual(
        withHistory,
        alone,
        `a prior week changed this week's story:\n  alone: ${JSON.stringify(alone)}\n  with:  ${JSON.stringify(withHistory)}`,
      );

      // Order must not smuggle it in either.
      assert.deepEqual(
        story([...week, ...past], {
          activity: [...rest.activity, ...restPast.activity],
          packs: [...rest.packs, ...restPast.packs],
          completions: [...rest.completions, ...restPast.completions],
        }),
        alone,
        'the story depends on the order history was stored in',
      );

      // And one input at a time, so a leak through any single door is named.
      for (const door of ['activity', 'packs', 'completions'] as const) {
        const only = { ...rest, [door]: [...restPast[door], ...rest[door]] };
        assert.deepEqual(story(week, only), alone, `a prior week leaked in through ${door}`);
      }

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
    const lead = story(goodWeek()).sentences[0]!;
    assert.match(lead, /on your own/, 'a mostly unaided week leads with independence');
    assert.ok(!/\d/.test(lead), `the independence lead printed a number: ${lead}`);
    assert.ok(!lead.includes('%'), 'independence is a sentence, never a rate');

    // Earned, not decorative: a week spent leaning on the tutor does not claim it.
    const helped = story(
      [
        session({ endedAt: NOON - 2 * DAY, unassistedRate: 0.2, words: ['merci'] }),
        session({ endedAt: NOON - DAY, unassistedRate: 0.1, words: ['bonjour'] }),
      ]);
    assert.ok(hasStory(helped), 'words actually produced remain a useful story even with support');
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

    const words = story(goodWeek()).sentences.find((line) => produced.test(line));
    assert.equal(words, 'You used 6 different French words this week.', 'the count is the real one');

    // One word is one word, not "1 different French words".
    const single = story([session({ endedAt: NOON - DAY, words: ['merci'] })]);
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
    const sounded = story(goodWeek()).sentences;
    assert.ok(
      sounded.some((line) => line === 'Your /y/ came out clearly this week.'),
      `the most consistent win of the week is the one named: ${sounded.join(' | ')}`,
    );

    const noWins = story([session({ endedAt: NOON - DAY, unassistedRate: 0.9, words: ['merci'] })]);
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
    assert.deepEqual(story([session({ endedAt: eighthDayBack, words: ['merci'] })]).sentences, []);

    // The first minute of the seventh local day back is in, however early it is.
    const seventhDayBack = at(2026, 8, 14, 0, 1);
    assert.ok(hasStory(story([session({ endedAt: seventhDayBack, words: ['merci'] })])));

    // And a sitting later today counts for today, not for tomorrow.
    assert.ok(hasStory(story([session({ endedAt: at(2026, 8, 20, 23, 30), words: ['merci'] })])));
  });

  test('the story names a place and a topic from this week, skips a topic it cannot say, and any prior history leaves it byte for byte the same', () => {
    // F560. A learner who only ever talks to the tutor writes no session, so
    // the week is read from the completions and the packs as well.
    const talked = story([], {
      completions: [
        { id: 'mission:cafe', at: NOON - 3 * DAY },
        { id: 'mission:hotel', at: NOON - DAY },
        { id: 'mission:cafe', at: NOON - DAY + 1000 },
      ],
      packs: [pack(NOON - 2 * DAY, ['Ordering coffee'])],
    });
    assert.deepEqual(talked.sentences, ['Scenes you practised this week: the café and the hotel.', 'You talked about ordering coffee this week.']);

    // The place is an authored noun, never the mission's own title, which
    // carries the word this file may never print.
    const home = story([], { completions: [{ id: 'mission:journee', at: NOON - DAY }] });
    assert.deepEqual(home.sentences, ['Scenes you practised this week: a chat at home.']);
    assert.ok(!home.sentences[0]!.toLowerCase().includes('day'));

    // A topic the sentence rules refuse is skipped whole, and the next one is
    // tried: a digit, a banned word, a day, a sentence of its own, a proper
    // noun kept as one.
    const skipped = story([], { packs: [pack(NOON - DAY, ['Your 3 cats', 'Breakfast plans', 'Monday mornings', 'Paris'])] });
    assert.deepEqual(skipped.sentences, ['You talked about Paris this week.']);
    const spoken = story([], { packs: [pack(NOON - DAY, ['It was fun.', 'Weekend plans', 'Ordering coffee'])] });
    assert.deepEqual(spoken.sentences, ['You talked about ordering coffee this week.'], 'a topic that is a sentence, or names the week, is skipped whole');
    const none = story([], { packs: [pack(NOON - DAY, ['Your 3 cats', 'Breakfast plans'])] });
    assert.deepEqual(none.sentences, ['You spent time with French this week.'], 'a pack with nothing sayable is still a week that happened');

    // The newest pack of the week speaks, and a mission the catalogue no
    // longer carries names nothing.
    const newest = story([], { packs: [pack(NOON - 5 * DAY, ['the bill']), pack(NOON - DAY, ['the weather'])], completions: [{ id: 'mission:gone', at: NOON - DAY }] });
    assert.deepEqual(newest.sentences, ['You talked about the weather this week.']);

    // A week of drills and review alone is a week that happened.
    assert.deepEqual(story([], { activity: [{ at: NOON - DAY }] }).sentences, ['You spent time with French this week.']);
    assert.equal(hasStory(story([], { activity: [{ at: NOON - 9 * DAY }] })), false, 'a sitting outside the week is not this week');

    // Independence still leads, and the cap still holds with three sources.
    const full = story(goodWeek(), {
      completions: [{ id: 'mission:cafe', at: NOON - DAY }],
      packs: [pack(NOON - DAY, ['the weather'])],
    });
    assert.equal(full.sentences[0], 'This week you mostly found the words on your own.');
    assert.equal(full.sentences.length, MAX_STORY_SENTENCES);

    // And the same prior-history rule, on every door, in one sweep.
    const next = rng(560);
    for (let run = 0; run < 200; run += 1) {
      const rest = { activity: randomActivity(next, 0), packs: randomPacks(next, 0), completions: randomCompletions(next, 0) };
      const alone = story([], rest);
      const withPast = story(randomPast(next), {
        activity: [...randomActivity(next, DAYS_IN_THE_STORY), ...rest.activity],
        packs: [...randomPacks(next, DAYS_IN_THE_STORY), ...rest.packs],
        completions: [...randomCompletions(next, DAYS_IN_THE_STORY), ...rest.completions],
      });
      assert.deepEqual(withPast, alone, `a prior week changed the story, round ${run}`);
    }
  });

  test('at most three sentences, however much happened', () => {
    const next = rng(99);
    for (let run = 0; run < 200; run += 1) {
      const told = story(randomWeek(next, NOON), {
        activity: randomActivity(next, 0),
        packs: randomPacks(next, 0),
        completions: randomCompletions(next, 0),
      });
      assert.ok(
        told.sentences.length <= MAX_STORY_SENTENCES,
        `${told.sentences.length} sentences: a learner who sees a wall of them reads none`,
      );
      assert.equal(new Set(told.sentences).size, told.sentences.length, 'the story said the same thing twice');
    }
  });
});
