import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DAILY_WORDS, type DailyWord } from './words.ts';
import { DAILY_SCENARIOS, SEED_TOPIC_MAX, seedTopicOf, type DailyScenario } from './scenarios.ts';
import { dailyPick, dayIndex } from './pick.ts';
import { MISSIONS } from '../missions/missions.ts';

/** The minimum sizes the ledger asks for. A pool this size repeats every few months. */
const MIN_WORDS = 90;
const MIN_SCENARIOS = 60;

/**
 * Every string a learner reads on one of these cards, labelled so a failure
 * names the field rather than the pool. The two pools are walked the same way
 * on purpose: one rule, applied twice, is what stops the smaller pool quietly
 * becoming the lenient one.
 */
function learnerStrings(entry: DailyWord | DailyScenario): { label: string; text: string }[] {
  return 'fr' in entry
    ? [
        { label: 'fr', text: entry.fr },
        { label: 'en', text: entry.en },
        { label: 'note', text: entry.note },
        { label: 'exampleFr', text: entry.exampleFr },
        { label: 'exampleEn', text: entry.exampleEn },
      ]
    : [
        { label: 'titleEn', text: entry.titleEn },
        { label: 'titleFr', text: entry.titleFr },
        { label: 'bodyEn', text: entry.bodyEn },
        { label: 'openingFr', text: entry.openingFr },
        { label: 'openingEn', text: entry.openingEn },
      ];
}

describe('the authored pools Home draws its two daily cards from', () => {
  test('the daily pools are large, unique, plain and short enough to ride the seed topic pipe — F389', () => {
    // Size first. A pool at the floor repeats roughly every three months for
    // words and every two for situations, which is the point of authoring this
    // many: the card has to still be worth reading in the second month.
    assert.ok(
      DAILY_WORDS.length >= MIN_WORDS,
      `the word of the day would repeat too soon: ${DAILY_WORDS.length} words, and the floor is ${MIN_WORDS}`,
    );
    assert.ok(
      DAILY_SCENARIOS.length >= MIN_SCENARIOS,
      `the daily situation would repeat too soon: ${DAILY_SCENARIOS.length} situations, and the floor is ${MIN_SCENARIOS}`,
    );

    // Ids are what a bookmark in My French points at, so two entries sharing
    // one would mean a saved word silently becoming a different word.
    const wordIds = new Set(DAILY_WORDS.map((w) => w.id));
    assert.equal(wordIds.size, DAILY_WORDS.length, 'two words share an id, and a bookmark cannot tell them apart');
    const scenarioIds = new Set(DAILY_SCENARIOS.map((s) => s.id));
    assert.equal(scenarioIds.size, DAILY_SCENARIOS.length, 'two situations share an id, and a bookmark cannot tell them apart');

    for (const word of DAILY_WORDS) {
      assert.match(word.id, /^word:[a-z-]+$/, `${word.id} is not shaped like a word id, and ids here are permanent`);
    }
    for (const scenario of DAILY_SCENARIOS) {
      assert.match(scenario.id, /^situation:[a-z-]+$/, `${scenario.id} is not shaped like a situation id, and ids here are permanent`);
    }

    // The copy rules, walked over both pools. The digit ban is the same one
    // drill feedback carries: a number on a card meant to be read rather than
    // scored is either a price that is already wrong or a count of nothing.
    for (const entry of [...DAILY_WORDS, ...DAILY_SCENARIOS]) {
      for (const { label, text } of learnerStrings(entry)) {
        assert.ok(text.trim().length > 0, `${entry.id} ${label} is empty, so the card would draw a blank line`);
        assert.equal(text, text.trim(), `${entry.id} ${label} carries stray whitespace into the layout`);
        assert.ok(!/—/.test(text), `${entry.id} ${label} contains an em dash: "${text}"`);
        assert.ok(!/\d/.test(text), `${entry.id} ${label} shows a digit on a card meant to be read, not scored: "${text}"`);
      }
    }

    // The French halves are the whole reason these cards exist. An empty one
    // is a card that teaches nothing and a session that opens on nothing.
    for (const word of DAILY_WORDS) {
      assert.ok(word.exampleFr.trim().length > 0, `${word.id} has no French example, so the card shows a meaning and no language`);
    }
    for (const scenario of DAILY_SCENARIOS) {
      assert.ok(scenario.openingFr.trim().length > 0, `${scenario.id} has no French opening line, so the learner has nothing to say first`);
    }

    // The pipe. `services/token-server/src/tokens.ts` drops a seed topic longer
    // than this rather than trimming it, and a dropped seed is a tutor opening
    // on nothing while the card on screen promises a café.
    assert.equal(SEED_TOPIC_MAX, 120, 'SEED_TOPIC_MAX must mirror MAX_SEED_TOPIC_CHARS in services/token-server/src/tokens.ts');
    for (const scenario of DAILY_SCENARIOS) {
      assert.ok(
        scenario.titleFr.length <= SEED_TOPIC_MAX,
        `${scenario.id} titleFr is ${scenario.titleFr.length} characters and the token server drops anything over ${SEED_TOPIC_MAX}`,
      );
      assert.ok(
        scenario.bodyEn.length <= SEED_TOPIC_MAX,
        `${scenario.id} bodyEn is ${scenario.bodyEn.length} characters and the token server drops anything over ${SEED_TOPIC_MAX}`,
      );
    }

    // Places are not a new vocabulary. They are the six the mission catalogue
    // already has art for, so a scenario can never ask for a disc nobody drew.
    const drawnPlaces = new Set(MISSIONS.map((m) => m.place));
    assert.equal(drawnPlaces.size, 6, 'the six places this pool leans on are the six the missions already draw');
    for (const scenario of DAILY_SCENARIOS) {
      assert.ok(drawnPlaces.has(scenario.place), `${scenario.id} names a place with no illustration: ${scenario.place}`);
    }
    const usedPlaces = new Set(DAILY_SCENARIOS.map((s) => s.place));
    for (const place of drawnPlaces) {
      assert.ok(usedPlaces.has(place), `no situation happens in ${place}, so that scene never comes round on Home`);
    }

    // The seed is the two strings and nothing else. Anything richer would be a
    // frame, and a frame is a mission, which this deliberately is not.
    for (const scenario of DAILY_SCENARIOS) {
      assert.deepEqual(
        seedTopicOf(scenario),
        { fr: scenario.titleFr, en: scenario.bodyEn },
        `${scenario.id} would open the tutor on something other than the scene the card shows`,
      );
    }
  });

  test('a word card says one thing per line, short enough for one screen', () => {
    // Not a style preference: the card draws the word in a display serif, and
    // a note that runs to three lines pushes the example off the bottom of it.
    for (const word of DAILY_WORDS) {
      assert.ok(word.fr.length <= 40, `${word.id} is a phrase, not a word of the day: "${word.fr}"`);
      assert.ok(word.en.length <= 48, `${word.id} explains where it should translate: "${word.en}"`);
      assert.ok(word.note.length <= 120, `${word.id} note is ${word.note.length} characters and the card has room for about a hundred`);
      assert.ok(word.exampleFr.length <= 80, `${word.id} exampleFr is too long to read at a glance: "${word.exampleFr}"`);
      assert.ok(word.exampleEn.length <= 80, `${word.id} exampleEn is too long to read at a glance: "${word.exampleEn}"`);
    }
  });
});

describe('the day decides, and nothing is stored', () => {
  test('the same local day always picks the same word and situation, and midnight changes both — F390', () => {
    // Known keys, counted by hand. The first is the epoch itself, and the
    // others are ordinary days: consecutive keys are exactly one apart, which
    // is the property every other assertion here rests on.
    assert.equal(dayIndex('1970-01-01'), 0, 'the epoch is day zero, which is what makes this a count of days rather than a hash');
    assert.equal(dayIndex('1970-01-02'), 1, 'the next day is one day later');
    assert.equal(dayIndex('2026-01-01'), 20454, 'a known day, counted from the epoch');
    assert.equal(dayIndex('2026-09-04'), 20700, 'a known day, counted from the epoch');
    assert.equal(dayIndex('2026-03-30') - dayIndex('2026-03-29'), 1, 'the day a European clock jumps forward is still one day long');
    assert.equal(dayIndex('2028-03-01') - dayIndex('2028-02-29'), 1, 'a leap day is a day like any other');
    assert.throws(
      () => dayIndex('4 September 2026'),
      /YYYY-MM-DD/,
      'a key that is not a day key is a bug in the caller, and silently counting it would pick a card at random',
    );

    // Local wall clock on both ends of one day, so this holds in any time zone
    // the test happens to run in.
    const justAfterMidnight = new Date(2026, 8, 4, 0, 1).getTime();
    const justBeforeMidnight = new Date(2026, 8, 4, 23, 59).getTime();
    const nextMorning = new Date(2026, 8, 5, 8, 0).getTime();

    assert.equal(
      dailyPick(DAILY_WORDS, justAfterMidnight).id,
      dailyPick(DAILY_WORDS, justBeforeMidnight).id,
      'the word of the day changed under a learner who opened the app twice in one day',
    );
    assert.equal(
      dailyPick(DAILY_SCENARIOS, justAfterMidnight).id,
      dailyPick(DAILY_SCENARIOS, justBeforeMidnight).id,
      'the situation changed under a learner who opened the app twice in one day',
    );
    assert.notEqual(
      dailyPick(DAILY_WORDS, justBeforeMidnight).id,
      dailyPick(DAILY_WORDS, nextMorning).id,
      'the word of the day did not move overnight, so the card is stale on the day it matters',
    );
    assert.notEqual(
      dailyPick(DAILY_SCENARIOS, justBeforeMidnight).id,
      dailyPick(DAILY_SCENARIOS, nextMorning).id,
      'the situation did not move overnight, so the card is stale on the day it matters',
    );

    // Order and history are not inputs. A fresh install walking straight to
    // this day sees what a two-year-old install sees, because the pick reads
    // neither an install date nor anything the learner has done.
    const freshInstall = dailyPick(DAILY_WORDS, justAfterMidnight).id;
    const freshSituation = dailyPick(DAILY_SCENARIOS, justAfterMidnight).id;
    for (let daysBefore = 730; daysBefore > 0; daysBefore -= 1) {
      const earlier = new Date(2026, 8, 4 - daysBefore, 9, 0).getTime();
      dailyPick(DAILY_WORDS, earlier);
      dailyPick(DAILY_SCENARIOS, earlier);
    }
    assert.equal(dailyPick(DAILY_WORDS, justAfterMidnight).id, freshInstall, 'two years of use changed what today shows, so something is being carried between calls');
    assert.equal(dailyPick(DAILY_SCENARIOS, justAfterMidnight).id, freshSituation, 'two years of use changed what today shows, so something is being carried between calls');

    // The two cards are picked from one clock, so asking in either order, or
    // twice, is the same question.
    const scenarioFirst = dailyPick(DAILY_SCENARIOS, justAfterMidnight).id;
    const wordSecond = dailyPick(DAILY_WORDS, justAfterMidnight).id;
    assert.equal(wordSecond, freshInstall, 'the word depends on which card was asked for first');
    assert.equal(scenarioFirst, freshSituation, 'the situation depends on which card was asked for first');

    // A day with no content in it has no honest card, and drawing an empty one
    // would hide a content bug behind a blank space on Home.
    assert.throws(
      () => dailyPick([], justAfterMidnight),
      /empty pool/,
      'an empty pool handed back undefined instead of saying so, and Home would draw a card with nothing on it',
    );
  });

  test('every day of a year lands on a real entry, and the sequence walks the whole pool', () => {
    // The modulo is written the long way in `pick.ts` for a reason: a negative
    // index reads off the front of the array and returns undefined, which is a
    // blank card rather than a crash. This walks a year plus the years before
    // the epoch, where that sign problem lives.
    const seen = new Set<string>();
    for (let day = 0; day < 400; day += 1) {
      const at = new Date(2026, 0, 1 + day, 12, 0).getTime();
      const word = dailyPick(DAILY_WORDS, at);
      assert.ok(word !== undefined && typeof word.id === 'string', `day ${day} of the walk picked nothing`);
      seen.add(word.id);
    }
    assert.equal(seen.size, DAILY_WORDS.length, 'a year and a bit should meet every word in the pool exactly once each time round');

    const beforeTheEpoch = new Date(1969, 5, 1, 12, 0).getTime();
    assert.ok(dayIndex('1969-06-01') < 0, 'the case this is here for: a day before the epoch counts backwards');
    assert.ok(dailyPick(DAILY_WORDS, beforeTheEpoch) !== undefined, 'a clock set before the epoch produced no card at all');
    assert.ok(dailyPick(DAILY_SCENARIOS, beforeTheEpoch) !== undefined, 'a clock set before the epoch produced no card at all');
  });

  test('the pick never reads the wall clock, only the moment it was handed', () => {
    // `now` is a parameter everywhere in core so a day rule can be tested
    // across a boundary. This is that rule enforced rather than trusted: if
    // anything in the module reached for the real clock, this throws.
    const realNow = Date.now;
    Date.now = () => {
      throw new Error('the daily pick read the wall clock instead of the moment it was given');
    };
    try {
      const at = new Date(2026, 8, 4, 7, 30).getTime();
      assert.ok(dailyPick(DAILY_WORDS, at).id.length > 0, 'the word of the day must come from the injected clock alone');
      assert.ok(dailyPick(DAILY_SCENARIOS, at).id.length > 0, 'the situation must come from the injected clock alone');
      assert.equal(dayIndex('2026-09-04'), 20700, 'the day index must come from the key alone');
    } finally {
      Date.now = realNow;
    }
  });
});
