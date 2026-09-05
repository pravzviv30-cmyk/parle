import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import { DAILY_WORDS, type DailyWord } from './words.ts';
import { DAILY_SCENARIOS, SEED_TOPIC_MAX, seedTopicOf, type DailyScenario } from './scenarios.ts';
import { dailyPick, dayIndex } from './pick.ts';
import { wordTierFor, wordsForLevel, type WordTier } from './tier.ts';
import { LEVEL_NAMES, LEVEL_THRESHOLDS, levelFor } from '../levels/levels.ts';
import { MISSIONS } from '../missions/missions.ts';

/** The minimum sizes the ledger asks for. A pool this size repeats every few months. */
const MIN_WORDS = 90;
const MIN_SCENARIOS = 60;

/** Every tier has to last a season on its own, because a learner only ever sees one. */
const MIN_WORDS_PER_TIER = 80;

/**
 * The ceiling, and it is not a taste judgement.
 *
 * The walk below steps through four hundred consecutive days and asserts that
 * every word in the pool came round. A pool larger than that walk can never
 * pass it, so this number and that loop have to move together or not at all.
 */
const MAX_WORDS = 400;

/**
 * The words a phrasebook covers on its first page.
 *
 * The founder read the shipped pool and named the problem exactly: `bonjour`
 * is not a word of the day, because everybody already knows it. This list is
 * that judgement written down. It is not the whole bar and cannot be, since no
 * list of fifty names every obvious word in French, but it is the part of the
 * bar a test can hold, and it makes the failure loud when the judgement slips.
 */
const PHRASEBOOK_FIRST_PAGE: readonly string[] = [
  'bonjour', 'bonsoir', 'salut', 'au revoir', 'merci', "s'il vous plaît", "s'il te plaît",
  'de rien', 'pardon', 'excusez-moi', 'désolé', 'oui', 'non', 'ça va', "d'accord",
  "je m'appelle", 'je voudrais', 'combien', 'un café', 'un thé', 'un croissant',
  'une baguette', 'la carte', "l'addition", 'le métro', 'un ticket', 'la gare', 'à gauche',
  'à droite', 'tout droit', 'où est', "aujourd'hui", 'demain', 'hier', 'maintenant',
  'un ami', 'la famille', 'un kilo', 'une pomme', 'le fromage', 'ouvert', 'fermé',
  'délicieux', 'santé', 'enchanté', 'bienvenue', 'à bientôt', 'chez moi', 'un peu',
  'beaucoup', 'très bien', 'bien sûr', 'bonne journée', 'bonne soirée', 'à demain',
  'comment allez-vous', 'et vous', 'peut-être', 'je ne sais pas', 'je ne comprends pas',
  'plus lentement', 'avec plaisir', 'pas de problème', 'voilà', 'attention', 'moi aussi',
  'la boulangerie', 'la pharmacie', 'par carte', 'la sortie', 'en retard', 'loin',
  'la rue', 'la place', 'une chambre', 'la clé', 'une nuit', 'la réception', 'une valise',
  "l'ascenseur", 'une réservation', 'la vue', 'le voisin', 'un cadeau', 'ce soir',
  'le matin', 'il pleut', 'il fait froid', 'toujours', 'souvent',
];

/**
 * The eight ids that survived the rewrite, and why they had to.
 *
 * An id is what a bookmark points at, so the pool was rewritten around them
 * rather than renumbered: every word that already cleared the phrasebook bar
 * kept the id it shipped with, and the rest retired without their ids ever
 * being handed to a different word.
 */
const KEPT_WORD_IDS: readonly string[] = [
  'word:un-creme',
  'word:une-carafe-deau',
  'word:sur-place-ou-a-emporter',
  'word:la-monnaie',
  'word:en-especes',
  'word:une-correspondance',
  'word:ca-marche',
  'word:a-table',
];

/**
 * Every situation id that has ever shipped, snapshotted.
 *
 * `savedSituations` in `apps/mobile/src/bookmarks/view.ts` drops an id it does
 * not recognise **silently**, so retiring one here would delete a learner's
 * bookmark rather than fail anything. That is why the wifi situation kept the
 * id `situation:hotel-internet-code` while both of its languages changed, and
 * it is why this list only ever grows.
 */
const SHIPPED_SITUATION_IDS: readonly string[] = [
  'situation:cafe-terrace', 'situation:cafe-first-coffee', 'situation:cafe-bill',
  'situation:cafe-bakery-counter', 'situation:cafe-menu-question', 'situation:cafe-water',
  'situation:cafe-take-away', 'situation:cafe-wrong-order', 'situation:cafe-sharing-table',
  'situation:cafe-paying-card', 'situation:cafe-evening-drink', 'situation:market-apples',
  'situation:market-cheese', 'situation:market-price', 'situation:market-bag',
  'situation:market-taste', 'situation:market-half', 'situation:market-strawberries',
  'situation:market-change', 'situation:market-last-stall', 'situation:market-pharmacy',
  'situation:market-butcher', 'situation:market-supermarket-till',
  'situation:street-metro-ticket', 'situation:street-which-line',
  'situation:street-wrong-direction', 'situation:street-asking-directions',
  'situation:street-museum', 'situation:street-taxi', 'situation:street-train-late',
  'situation:street-platform', 'situation:street-exit', 'situation:street-bag-on-the-train',
  'situation:street-bus', 'situation:street-an-hour-to-spare', 'situation:hotel-check-in',
  'situation:hotel-late-arrival', 'situation:hotel-quieter-room',
  'situation:hotel-morning-meal', 'situation:hotel-leaving-the-key',
  'situation:hotel-internet-code', 'situation:hotel-luggage', 'situation:hotel-extra-night',
  'situation:hotel-where-to-eat', 'situation:hotel-cold-room', 'situation:hotel-check-out',
  'situation:hotel-taxi-request', 'situation:friends-first-meeting',
  'situation:friends-where-from', 'situation:friends-catch-up',
  'situation:friends-plans-tonight', 'situation:friends-invite',
  'situation:friends-running-late', 'situation:friends-birthday',
  'situation:friends-what-you-do', 'situation:friends-film-talk',
  'situation:friends-leaving-a-party', 'situation:friends-weekend',
  'situation:friends-language-swap', 'situation:home-dinner-guest',
  'situation:home-compliment-the-food', 'situation:home-second-helping',
  'situation:home-turning-down-a-dish', 'situation:home-helping-in-the-kitchen',
  'situation:home-meeting-the-family', 'situation:home-neighbour', 'situation:home-phone-call',
  'situation:home-a-parcel', 'situation:home-what-time-dinner', 'situation:home-tea-or-coffee',
  'situation:home-thanking-your-host',
];

/**
 * Phrases that are a translation of the wrong language.
 *
 * `The internet code` was on Home for a fortnight before the founder read it
 * and said what it obviously was: a French `code wifi` carried into English
 * word by word. `morning meal` and `right side` were the same mistake in the
 * other direction, written to dodge a banned word rather than to say what a
 * person says. A tripwire cannot judge naturalness, but it can stop these five
 * from coming back.
 */
const CALQUES: readonly string[] = [
  'internet code',
  'code internet',
  'morning meal',
  'right side',
  'is plenty',
];

/** Lowercase, with a curly apostrophe read as a straight one. Mirrors `guiltIn`. */
function normalise(line: string): string {
  return line.toLowerCase().replace(/[\u2018\u2019]/g, "'");
}

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

describe('the word of the day is worth reading, and pitched at whoever is reading it', () => {
  test('every daily word clears the phrasebook bar, carries a tier, and each tier is deep enough to last a season — F422', () => {
    // The bar the founder set, in the only form a test can hold it. A word on
    // the first page of a phrasebook spends a learner's one daily reading on
    // something they had before they installed anything.
    const firstPage = new Set(PHRASEBOOK_FIRST_PAGE.map(normalise));
    assert.equal(
      firstPage.size,
      PHRASEBOOK_FIRST_PAGE.length,
      'the phrasebook list repeats itself, which makes it shorter than it looks',
    );
    for (const word of DAILY_WORDS) {
      assert.ok(
        !firstPage.has(normalise(word.fr)),
        `${word.id} is a word a phrasebook covers on its first page, so the card teaches nothing: "${word.fr}"`,
      );
    }

    // Two entries teaching the same French is the same waste one day later.
    const spellings = new Set(DAILY_WORDS.map((w) => normalise(w.fr)));
    assert.equal(spellings.size, DAILY_WORDS.length, 'two words teach the same French, so one day of the year is spent twice');

    // Every word carries a tier, checked by the sum rather than by the type:
    // the type is erased at runtime and this pool is authored by hand.
    const tiers: readonly WordTier[] = [1, 2, 3];
    const byTier = tiers.map((tier) => ({ tier, words: DAILY_WORDS.filter((w) => w.tier === tier) }));
    assert.equal(
      byTier.reduce((count, bucket) => count + bucket.words.length, 0),
      DAILY_WORDS.length,
      'a word carries a tier that is not one, two or three, so nobody would ever be shown it',
    );

    // A learner only ever sees one tier, so each one has to last on its own.
    for (const { tier, words } of byTier) {
      assert.ok(
        words.length >= MIN_WORDS_PER_TIER,
        `tier ${tier} has ${words.length} words and would come round again inside a season, and the floor is ${MIN_WORDS_PER_TIER}`,
      );
    }

    // The ceiling is the walk further down this file, not a matter of taste.
    assert.ok(
      DAILY_WORDS.length >= MIN_WORDS_PER_TIER * tiers.length,
      `the pool is ${DAILY_WORDS.length} words, and three tiers at the floor need ${MIN_WORDS_PER_TIER * tiers.length}`,
    );
    assert.ok(
      DAILY_WORDS.length <= MAX_WORDS,
      `the pool is ${DAILY_WORDS.length} words and the four hundred day walk can never meet more than ${MAX_WORDS} of them`,
    );

    // Ids are what a bookmark points at. The rewrite went around the eight
    // words that already cleared the bar rather than renumbering the pool.
    const ids = new Set(DAILY_WORDS.map((w) => w.id));
    for (const kept of KEPT_WORD_IDS) {
      assert.ok(ids.has(kept), `${kept} cleared the phrasebook bar and then lost its id anyway, which moves a saved word`);
    }

    // French typography, on the French half only. A question mark hard against
    // the last letter is the mark of English written in French words.
    for (const word of DAILY_WORDS) {
      for (const [label, text] of [['fr', word.fr], ['exampleFr', word.exampleFr]] as const) {
        assert.ok(
          !/\S[?!]/.test(text),
          `${word.id} ${label} is missing the space French puts before a question mark: "${text}"`,
        );
      }
    }
  });
});

describe('the tier rises with the learner, and the day still picks the word', () => {
  test("the learner's level picks the tier by one rule, and the tier picks the word by the day — F423", () => {
    // The rule, spelled out rather than described. Six level names, three
    // tiers, and no arithmetic anywhere else in the app that could disagree.
    assert.equal(wordTierFor(0), 1, 'a Beginner gets tier one');
    assert.equal(wordTierFor(1), 1, 'a Rookie gets tier one');
    assert.equal(wordTierFor(2), 2, 'a General gets tier two');
    assert.equal(wordTierFor(3), 2, 'a Captain gets tier two');
    assert.equal(wordTierFor(4), 3, 'a Master gets tier three');
    assert.equal(wordTierFor(5), 3, 'a Veteran gets tier three');
    assert.equal(wordTierFor(LEVEL_NAMES.length - 1), 3, 'the top of the ladder is the top tier');
    assert.equal(wordTierFor(LEVEL_NAMES.length + 10), 3, 'a level that does not exist yet still lands on a real tier');

    // Nonsense in gives the gentlest pool, because this runs on the path that
    // draws Home and a blank card is worse than a beginner's word.
    assert.equal(wordTierFor(-1), 1, 'a negative index is not a level, and it must not read off the front of the ladder');
    assert.equal(wordTierFor(Number.NaN), 1, 'unreadable XP must still draw a card');
    assert.equal(wordTierFor(Number.POSITIVE_INFINITY), 1, 'an infinite index is not a level either');
    assert.equal(wordTierFor(1.9), 1, 'a fraction is floored, so most of the way to General is still Rookie');

    // It reads the app's one level standing. `levelFor(totalXp(...))` is fed by
    // production alone, which is what keeps this a pitch rather than a reward.
    assert.equal(wordTierFor(levelFor(0).index), 1, 'a learner who has said nothing yet meets tier one on day one');
    assert.equal(wordTierFor(levelFor(LEVEL_THRESHOLDS[2]!).index), 2, 'the third threshold is where tier two starts');
    assert.equal(wordTierFor(levelFor(LEVEL_THRESHOLDS[4]!).index), 3, 'the fifth threshold is where tier three starts');

    // Every name on the ladder has words to be shown, and only its own.
    for (let index = 0; index < LEVEL_NAMES.length; index += 1) {
      const words = wordsForLevel(DAILY_WORDS, index);
      assert.ok(words.length > 0, `${LEVEL_NAMES[index]} has no words at all, so Home would draw an empty card`);
      for (const word of words) {
        assert.equal(word.tier, wordTierFor(index), `${word.id} was offered to a ${LEVEL_NAMES[index]} from another tier`);
      }
    }

    // The three tiers partition the pool, and the filter keeps pool order, so
    // the sequence a learner walks is the one somebody authored.
    const rookie = wordsForLevel(DAILY_WORDS, 1);
    const captain = wordsForLevel(DAILY_WORDS, 3);
    const veteran = wordsForLevel(DAILY_WORDS, 5);
    assert.equal(
      rookie.length + captain.length + veteran.length,
      DAILY_WORDS.length,
      'the three tiers do not add up to the pool, so some word can never be shown to anybody',
    );
    for (const tierWords of [rookie, captain, veteran]) {
      const positions = tierWords.map((word) => DAILY_WORDS.indexOf(word));
      assert.deepEqual(
        positions,
        [...positions].sort((a, b) => a - b),
        'wordsForLevel reordered the pool, so the run of words a learner walks is not the authored one',
      );
    }

    // `dailyPick` is untouched: the tier narrows the pool, the day picks from it.
    const morning = new Date(2026, 8, 4, 9, 0).getTime();
    const lateSameDay = new Date(2026, 8, 4, 23, 30).getTime();
    const nextDay = new Date(2026, 8, 5, 9, 0).getTime();
    assert.equal(
      dailyPick(rookie, morning).id,
      dailyPick(rookie, lateSameDay).id,
      'the word changed under a learner who opened the app twice in one day',
    );
    assert.notEqual(
      dailyPick(rookie, morning).id,
      dailyPick(rookie, nextDay).id,
      'the word did not move overnight, so the card is stale on the day it matters',
    );
    assert.equal(dailyPick(rookie, morning).tier, 1, 'a Rookie was shown a word from another tier');
    assert.equal(dailyPick(veteran, morning).tier, 3, 'a Veteran was shown a word from another tier');

    // Crossing a level boundary re-phases the sequence. Named here because it
    // is visible to a learner, and accepted: the alternative is storing a
    // position, which is a second source of truth about a day.
    assert.notEqual(
      dailyPick(wordsForLevel(DAILY_WORDS, 1), morning).id,
      dailyPick(wordsForLevel(DAILY_WORDS, 2), morning).id,
      'the tier is not narrowing anything, since a promotion changed nothing on the day it happened',
    );

    // One full turn of a tier meets every word in it, and nothing outside it.
    const seen = new Set<string>();
    for (let day = 0; day < rookie.length; day += 1) {
      const at = new Date(2026, 0, 1 + day, 12, 0).getTime();
      const word = dailyPick(rookie, at);
      assert.equal(word.tier, 1, `day ${day} of a Rookie's year showed a word from tier ${word.tier}`);
      seen.add(word.id);
    }
    assert.equal(seen.size, rookie.length, 'one turn of the tier should meet every word in it exactly once');

    // A tier with nothing in it is a content bug, and it says so rather than
    // quietly falling back to a tier the learner was not pitched at.
    assert.throws(
      () => dailyPick(wordsForLevel([], 0), morning),
      /empty pool/,
      'an empty tier drew a card from somewhere, which would hide a content bug on Home',
    );
  });
});

describe('the situations say what people say, and keep every id they shipped with', () => {
  test('the situations say what a person would say in both languages, and every id that ever shipped is still there — F424', () => {
    // The snapshot. `savedSituations` drops an id it does not recognise without
    // a word, so a retired id is a deleted bookmark rather than a failure.
    const ids = DAILY_SCENARIOS.map((s) => s.id);
    for (const shipped of SHIPPED_SITUATION_IDS) {
      assert.ok(
        ids.includes(shipped),
        `${shipped} has left the pool, and a learner who bookmarked it would lose it silently`,
      );
    }
    assert.equal(
      ids.length,
      SHIPPED_SITUATION_IDS.length,
      'the pool and the snapshot disagree: add any new situation id to SHIPPED_SITUATION_IDS so this list stays the record',
    );

    // The tripwire. It cannot judge naturalness, but these five are the exact
    // phrases the founder and the audit caught, and they must not come back.
    for (const scenario of DAILY_SCENARIOS) {
      for (const { label, text } of learnerStrings(scenario)) {
        for (const calque of CALQUES) {
          assert.ok(
            !normalise(text).includes(calque),
            `${scenario.id} ${label} says "${calque}", which is one language written in the other: "${text}"`,
          );
        }
      }
    }

    // The four that were rewritten, pinned by what they say now.
    const byId = new Map(DAILY_SCENARIOS.map((s) => [s.id, s]));
    const wifi = byId.get('situation:hotel-internet-code');
    assert.ok(wifi !== undefined, 'the wifi situation kept its id, so it has to still be here under it');
    assert.equal(wifi.titleEn, 'The wifi password', 'the founder circled this card by name');
    assert.equal(wifi.titleFr, 'Le code wifi', 'this is what the sign behind a French hotel desk says');
    assert.equal(byId.get('situation:hotel-morning-meal')?.titleEn, 'Coffee before an early start');
    assert.equal(byId.get('situation:market-half')?.titleEn, 'Asking for less than that');
    assert.equal(byId.get('situation:street-wrong-direction')?.titleEn, 'Making sure it is the right train');

    // `titleFr` is pinned as well as `titleEn`, and not for symmetry: it is the
    // `fr` half of the seed topic, so a French title that drifts back sends the
    // tutor to one scene while the card on screen promises another.
    assert.equal(byId.get('situation:hotel-morning-meal')?.titleFr, 'Un café avant de partir');
    assert.equal(byId.get('situation:market-half')?.titleFr, 'Un peu moins, merci');
    assert.equal(byId.get('situation:street-wrong-direction')?.titleFr, 'La bonne direction');

    // Both halves of a rewritten card are about the same thing. A card whose
    // French moved and whose English did not is the calque coming back under a
    // different sentence.
    const bothSides = [
      { id: 'situation:hotel-internet-code', fr: 'wifi', en: 'wifi' },
      { id: 'situation:hotel-morning-meal', fr: 'café', en: 'coffee' },
      { id: 'situation:market-half', fr: 'moitié', en: 'half' },
      { id: 'situation:street-wrong-direction', fr: 'train', en: 'train' },
    ] as const;
    for (const { id, fr, en } of bothSides) {
      const scenario = byId.get(id);
      assert.ok(scenario !== undefined, `${id} is not in the pool`);
      assert.ok(
        normalise(`${scenario.titleFr} ${scenario.openingFr}`).includes(fr),
        `${id} stopped saying ${fr} in French while its English still says ${en}`,
      );
      assert.ok(
        normalise(`${scenario.titleEn} ${scenario.bodyEn} ${scenario.openingEn}`).includes(en),
        `${id} stopped saying ${en} in English while its French still says ${fr}`,
      );
    }

    // The opening line is the one pair that really is a translation of itself,
    // because the learner reads the English and then says the French. A
    // question in one language is a question in the other.
    for (const scenario of DAILY_SCENARIOS) {
      assert.equal(
        scenario.openingFr.trim().endsWith('?'),
        scenario.openingEn.trim().endsWith('?'),
        `${scenario.id} asks a question in one language and states something in the other: "${scenario.openingFr}" / "${scenario.openingEn}"`,
      );
    }

    // French typography on the French half, the same rule the word pool keeps.
    for (const scenario of DAILY_SCENARIOS) {
      for (const [label, text] of [['titleFr', scenario.titleFr], ['openingFr', scenario.openingFr]] as const) {
        assert.ok(
          !/\S[?!]/.test(text),
          `${scenario.id} ${label} is missing the space French puts before a question mark: "${text}"`,
        );
      }
    }
  });
});
